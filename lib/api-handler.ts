import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { unstable_cache, revalidateTag } from "next/cache";
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
import { requirePermission } from "@/lib/auth-server";
import { Permission } from "@/lib/permissions";
import { cleanupOldAudioFile } from "@/lib/audio-cleanup";
import { generateSearchFields } from "@/lib/search-utils";
import { transformStorageKeyToUrl } from "@/lib/storage";

export interface CRUDHandlerOptions<CreateSchema extends z.ZodType, UpdateSchema extends z.ZodType> {
  collection: string;
  createSchema: CreateSchema;
  updateSchema: UpdateSchema;
  uniqueField?: string;
  filterableFields?: string[];
  searchableFields?: string[];
  createPermission?: Permission;
  updatePermission?: Permission;
  deletePermission?: Permission;
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

async function transformDocumentTtsUrl(doc: { id: string; [key: string]: unknown }): Promise<{ id: string; [key: string]: unknown }> {
  const ttsUrl = doc.tts_url;
  
  if (ttsUrl && typeof ttsUrl === "string") {
    try {
      const transformedUrl = await transformStorageKeyToUrl(ttsUrl);
      return { ...doc, tts_url: transformedUrl };
    } catch (error) {
      logger.warn("Failed to transform tts_url", { id: doc.id, error: (error as Error).message });
      return doc;
    }
  }
  
  return doc;
}

async function transformDocumentsTtsUrl(docs: Array<{ id: string; [key: string]: unknown }>): Promise<Array<{ id: string; [key: string]: unknown }>> {
  return Promise.all(docs.map(transformDocumentTtsUrl));
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
  searchableFields: string[] = [],
): { query: FirebaseFirestore.Query; searchField?: string } {
  let query: FirebaseFirestore.Query = adminDb.collection(collection);
  let searchField: string | undefined;

  for (const field of filterableFields) {
    const value = searchParams.get(field);
    if (value) {
      if (value.includes("*")) {
        const prefix = value.replace(/\*/g, "");
        if (prefix) {
          if (searchableFields.includes(field)) {
            const lowerPrefix = prefix.toLowerCase();
            query = query
              .where(`_search.${field}`, ">=", lowerPrefix)
              .where(`_search.${field}`, "<=", lowerPrefix + "\uf8ff");
            searchField = `_search.${field}`;
          } else {
            query = query.where(field, ">=", prefix).where(field, "<=", prefix + "\uf8ff");
            searchField = field;
          }
        }
      } else {
        query = query.where(field, "==", value);
      }
    }
  }

  return { query, searchField };
}

function buildCountQuery(
  collection: string,
  filterableFields: string[],
  searchParams: URLSearchParams,
  searchField?: string,
): FirebaseFirestore.Query {
  let query: FirebaseFirestore.Query = adminDb.collection(collection);

  for (const field of filterableFields) {
    const value = searchParams.get(field);
    if (value) {
      if (value.includes("*")) {
        const prefix = value.replace(/\*/g, "");
        if (prefix) {
          if (searchField) {
            query = query.where(searchField, ">=", prefix.toLowerCase()).where(searchField, "<=", prefix.toLowerCase() + "\uf8ff");
          }
        }
      } else {
        query = query.where(field, "==", value);
      }
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
    filterableFields = [],
    searchableFields = [],
    createPermission,
    updatePermission,
    deletePermission,
  } = options;

  const resolvedCreatePermission: Permission = createPermission || `${collection}:create` as Permission;
  const resolvedUpdatePermission: Permission = updatePermission || `${collection}:edit` as Permission;
  const resolvedDeletePermission: Permission = deletePermission || `${collection}:delete` as Permission;

  async function fetchCollectionData(
    collectionName: string,
    filterParams: string,
    limit: number,
    offset: number,
  ) {
    const paramsObj = JSON.parse(filterParams) as Record<string, string>;
    const params = new URLSearchParams(paramsObj);
    const queryObj = buildFilterQuery(collectionName, filterableFields, params, searchableFields);
    let query = queryObj.query;
    const searchField = queryObj.searchField;

    if (searchField) {
      query = query.orderBy(searchField);
    } else {
      query = query.orderBy("__name__");
    }

    query = query.offset(offset).limit(limit + 1);

    const snapshot = await query.get();

    const countQuery = buildCountQuery(collectionName, filterableFields, params, searchField);
    const countSnapshot = await countQuery.get();
    const totalCount = countSnapshot.size;

    if (snapshot.empty) {
      return {
        data: [],
        total: 0,
        totalCount,
        hasMore: false,
      };
    }

    const docs = snapshot.docs;
    const hasMore = docs.length > limit;
    const resultDocs = hasMore ? docs.slice(0, limit) : docs;

    const data = resultDocs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const transformedData = await transformDocumentsTtsUrl(data);

    return {
      data: transformedData,
      total: transformedData.length,
      totalCount,
      hasMore,
    };
  }

  async function GET(request: NextRequest) {
    try {
      const searchParams = request.nextUrl.searchParams;
      const { limit, page } = parsePaginationParams(request);
      const offset = (page - 1) * limit;

      const filterParams = Object.fromEntries(searchParams.entries());
      const filterString = JSON.stringify(filterParams);

      const cachedFetch = unstable_cache(
        fetchCollectionData,
        [collection, "fetch"],
        {
          tags: [collection],
          revalidate: 60,
        }
      );

      const result = await cachedFetch(collection, filterString, limit, offset);

      return successResponse(result.data, 200, {
        total: result.total,
        totalCount: result.totalCount,
        hasMore: result.hasMore,
        page,
      });
    } catch (error) {
      logger.error("GET request failed", { collection, error: (error as Error).message });
      return serverErrorResponse("Failed to fetch records");
    }
  }

  // POST: Create new entry
  async function POST(request: NextRequest) {
    try {
      const authHeader = request.headers.get("authorization");
      const authResult = await requirePermission(authHeader, resolvedCreatePermission);

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

      const validData = validation.data as Record<string, unknown>;

      if (uniqueField) {
        const existingDocs = await adminDb
          .collection(collection)
          .where(uniqueField, "==", validData[uniqueField])
          .get();

        if (!existingDocs.empty) {
          return conflictResponse(`${uniqueField} already exists`);
        }
      }

      // Add search fields
      if (searchableFields.length > 0) {
        validData._search = generateSearchFields(validData, searchableFields);
      }

      const newDocRef = await adminDb.collection(collection).add(validData);

      revalidateTag(collection, 'max');

      logger.info("Document created", {
        collection,
        id: newDocRef.id,
        userId: authResult.uid,
        userRole: authResult.role,
      });

      return successResponse({ id: newDocRef.id, ...validData }, 201);
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

  // PUT: Update existing entry
  async function PUT(request: NextRequest) {
    try {

      const authHeader = request.headers.get("authorization");
      const authResult = await requirePermission(authHeader, resolvedUpdatePermission);

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

      // Update search fields
      if (searchableFields.length > 0) {
        updateData._search = generateSearchFields(updateData, searchableFields);
      }

      await docRef.update(updateData);

      revalidateTag(collection, 'max');

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

  // DELETE: Remove entry
  async function DELETE(request: NextRequest) {
    try {
      const authHeader = request.headers.get("authorization");
      const authResult = await requirePermission(authHeader, resolvedDeletePermission);

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

      revalidateTag(collection, 'max');

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
