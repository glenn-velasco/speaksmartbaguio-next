import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { cache, DEFAULT_CACHE_TTL, generateCacheKey } from "@/lib/cache";
import {
  successResponse,
  notFoundResponse,
  badRequestResponse,
  conflictResponse,
  serverErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/response";
import { parsePaginationParams } from "@/lib/pagination";
import { requireEditorOrAdmin, requireAdmin, verifyToken } from "@/lib/auth-server";
import { UserRole } from "@/lib/user-roles";
import { cleanupOldAudioFile } from "@/lib/audio-cleanup";

export interface CRUDHandlerOptions<CreateSchema extends z.ZodType, UpdateSchema extends z.ZodType> {
  collection: string;
  createSchema: CreateSchema;
  updateSchema: UpdateSchema;
  uniqueField?: string;
  cacheTTL?: number;
  filterableFields?: string[];
  /**
   * Required role for POST/PUT operations.
   * Default: ["editor", "admin"]
   */
  writeRole?: UserRole | UserRole[];
  /**
   * Required role for DELETE operations.
   * Default: ["admin"]
   */
  deleteRole?: UserRole | UserRole[];
}

type SafeParseResult<T extends z.ZodType> =
  | { success: true; data: z.infer<T> }
  | { success: false; error: string; details: unknown };

function safeParseSchema<T extends z.ZodType>(schema: T, data: unknown): SafeParseResult<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      error: "Validation failed",
      details: result.error.flatten(),
    };
  }

  return { success: true, data: result.data };
}

async function parseRequestBody(request: NextRequest): Promise<unknown> {
  const contentType = request.headers.get("content-type");

  if (!contentType || !contentType.includes("application/json")) {
    throw new Error("Content-Type must be application/json");
  }

  try {
    return await request.json();
  } catch {
    throw new Error("Invalid JSON body");
  }
}

function buildFilterQuery(
  collection: string,
  filterableFields: string[],
  searchParams: URLSearchParams,
): FirebaseFirestore.Query {
  let query: FirebaseFirestore.Query = adminDb.collection(collection);

  for (const field of filterableFields) {
    const value = searchParams.get(field);
    if (value) {
      query = query.where(field, "==", value);
    }
  }

  return query;
}

export function createCRUDHandler<CreateSchema extends z.ZodType, UpdateSchema extends z.ZodType>(
  options: CRUDHandlerOptions<CreateSchema, UpdateSchema>,
) {
  const {
    collection,
    createSchema,
    updateSchema,
    uniqueField,
    cacheTTL = DEFAULT_CACHE_TTL,
    filterableFields = [],
  } = options;

  async function GET(request: NextRequest) {
    try {
      const searchParams = request.nextUrl.searchParams;
      const { limit, cursor } = parsePaginationParams(request);

      // Check cache
      const cacheKey = generateCacheKey(`/api/v1/${collection}`, Object.fromEntries(searchParams.entries()));
      
      const cached = cache.get(cacheKey);

      if (cached) {

        logger.debug("Cache hit", { collection, cacheKey });

        // cached already has { data, total, hasMore, nextCursor } shape
        return NextResponse.json(cached, { status: 200 });
      }

      let query = buildFilterQuery(collection, filterableFields, searchParams);

      // Apply cursor-based pagination
      if (cursor) {
        const cursorDoc = await adminDb.collection(collection).doc(cursor).get();
        if (cursorDoc.exists) {
          query = query.orderBy("__name__").startAfter(cursorDoc);
        }
      } else {
        query = query.orderBy("__name__");
      }

      // Fetch one extra to determine hasMore
      const snapshot = await query.limit(limit + 1).get();

      if (snapshot.empty) {
        return successResponse([], 200, { total: 0, hasMore: false });
      }

      const docs = snapshot.docs;
      const hasMore = docs.length > limit;
      const resultDocs = hasMore ? docs.slice(0, limit) : docs;
      const nextCursor = hasMore ? resultDocs[resultDocs.length - 1].id : undefined;

      const data = resultDocs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const result = {
        data,
        total: data.length,
        hasMore,
        ...(nextCursor ? { nextCursor } : {}),
      };

      // Cache the result
      cache.set(cacheKey, result, cacheTTL);

      return successResponse(data, 200, { total: data.length, hasMore, ...(nextCursor ? { nextCursor } : {}) });
    } catch (error) {
      logger.error("GET request failed", { collection, error: (error as Error).message });
      return serverErrorResponse("Failed to fetch records");
    }
  }

  // POST: Create new entry (requires editor or admin)
  async function POST(request: NextRequest) {
    try {
      // Check authentication and role
      const authHeader = request.headers.get("authorization");
      const authResult = await requireEditorOrAdmin(authHeader);

      if ("error" in authResult) {
        return authResult.status === 401
          ? unauthorizedResponse(authResult.error)
          : forbiddenResponse(authResult.error);
      }

      const body = await parseRequestBody(request);
      const validation = safeParseSchema(createSchema, body);

      if (!validation.success) {
        return badRequestResponse(validation.error, validation.details);
      }

      const validData = validation.data;

      // Check for duplicates
      if (uniqueField) {
        const existingDocs = await adminDb
          .collection(collection)
          .where(uniqueField, "==", (validData as Record<string, unknown>)[uniqueField])
          .get();

        if (!existingDocs.empty) {
          return conflictResponse(`${uniqueField} already exists`);
        }
      }

      const newDocRef = await adminDb.collection(collection).add(validData as Record<string, unknown>);

      // Get the created document and add to cache
      const newDoc = await newDocRef.get();
      const newItem = { id: newDocRef.id, ...newDoc.data() };

      // Smart cache update: add new item to existing cached lists
      cache.addItemToCollection(collection, newItem);

      logger.info("Document created", {
        collection,
        id: newDocRef.id,
        userId: authResult.uid,
        userRole: authResult.role,
      });

      return successResponse({ id: newDocRef.id, ...(validData as Record<string, unknown>) }, 201);
    } catch (error) {
      if ((error as Error).message === "Content-Type must be application/json") {
        return badRequestResponse((error as Error).message);
      }
      if ((error as Error).message === "Invalid JSON body") {
        return badRequestResponse((error as Error).message);
      }
      logger.error("POST request failed", { collection, error: (error as Error).message });
      return serverErrorResponse("Failed to create entry");
    }
  }

  // PUT: Update existing entry (requires editor or admin)
  async function PUT(request: NextRequest) {
    try {
      // Check authentication and role
      const authHeader = request.headers.get("authorization");
      const authResult = await requireEditorOrAdmin(authHeader);

      if ("error" in authResult) {
        return authResult.status === 401
          ? unauthorizedResponse(authResult.error)
          : forbiddenResponse(authResult.error);
      }

      const body = await parseRequestBody(request);
      const validation = safeParseSchema(updateSchema, body);

      if (!validation.success) {
        return badRequestResponse(validation.error, validation.details);
      }

      const { id, ...updateData } = validation.data as Record<string, unknown> & { id: string };

      const docRef = adminDb.collection(collection).doc(id);
      const docSnapshot = await docRef.get();

      if (!docSnapshot.exists) {
        return notFoundResponse("Document");
      }

      // Check if tts_url is being changed and cleanup old file
      const oldData = docSnapshot.data();
      const oldTtsUrl = oldData?.tts_url;
      const newTtsUrl = updateData.tts_url;

      if (oldTtsUrl && newTtsUrl && oldTtsUrl !== newTtsUrl) {
        logger.info("TTS URL changed, cleaning up old file", {
          collection,
          id,
          oldUrl: oldTtsUrl,
          newUrl: newTtsUrl,
        });
        const cleanupResult = await cleanupOldAudioFile(collection, id, oldTtsUrl);
        if (!cleanupResult.success) {
          logger.warn("Cleanup warning", { collection, id, message: cleanupResult.message });
        }
      }

      await docRef.update(updateData);

      // Get updated document and update cache
      const updatedDoc = await docRef.get();
      const updatedItem = { id, ...updatedDoc.data() };

      // Smart cache update: update item in existing cached lists
      cache.updateItemInCollection(collection, id, updatedItem);

      logger.info("Document updated", {
        collection,
        id,
        userId: authResult.uid,
        userRole: authResult.role,
      });

      return successResponse({ message: "Entry updated successfully", id });
    } catch (error) {
      if ((error as Error).message === "Content-Type must be application/json") {
        return badRequestResponse((error as Error).message);
      }
      if ((error as Error).message === "Invalid JSON body") {
        return badRequestResponse((error as Error).message);
      }
      logger.error("PUT request failed", { collection, error: (error as Error).message });
      return serverErrorResponse("Failed to update entry");
    }
  }

  // DELETE: Remove entry (requires admin only)
  async function DELETE(request: NextRequest) {
    try {
      // Check authentication and role (admin only)
      const authHeader = request.headers.get("authorization");
      const authResult = await requireAdmin(authHeader);

      if ("error" in authResult) {
        return authResult.status === 401
          ? unauthorizedResponse(authResult.error)
          : forbiddenResponse(authResult.error);
      }

      const searchParams = request.nextUrl.searchParams;
      const id = searchParams.get("id");

      if (!id) {
        return badRequestResponse("Document ID is required");
      }

      const docRef = adminDb.collection(collection).doc(id);
      const docSnapshot = await docRef.get();

      if (!docSnapshot.exists) {
        return notFoundResponse("Document");
      }

      // Cleanup associated audio file if exists
      const docData = docSnapshot.data();
      if (docData?.tts_url) {
        logger.info("Cleaning up audio file on document deletion", {
          collection,
          id,
          audioUrl: docData.tts_url,
        });
        const cleanupResult = await cleanupOldAudioFile(collection, id, docData.tts_url);
        if (!cleanupResult.success) {
          logger.warn("Cleanup warning", { collection, id, message: cleanupResult.message });
        }
      }

      await docRef.delete();

      // Smart cache removal: remove item from existing cached lists
      cache.removeItemFromCollection(collection, id);

      logger.info("Document deleted", {
        collection,
        id,
        userId: authResult.uid,
        userRole: authResult.role,
      });

      return successResponse({ message: "Entry deleted successfully", id });
    } catch (error) {
      logger.error("DELETE request failed", { collection, error: (error as Error).message });
      return serverErrorResponse("Failed to delete entry");
    }
  }

  return { GET, POST, PUT, DELETE };
}
