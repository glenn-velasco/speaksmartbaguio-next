import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { cache, DEFAULT_CACHE_TTL, generateCacheKey } from "@/lib/cache";
import {
  successResponse,
  badRequestResponse,
  serverErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/response";
import { parsePaginationParams } from "@/lib/pagination";
import { requirePermission } from "@/lib/auth-server";
import { UserRole } from "@/lib/user-roles";
import { setUserRole } from "@/lib/admin-roles";

const updateUserRoleSchema = z.object({
  uid: z.string().min(1, "User ID is required"),
  role: z.enum(["admin", "editor", "viewer"]),
});

const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  displayName: z.string().optional(),
  role: z.enum(["admin", "editor", "viewer"]).optional().default("viewer"),
});

/**
 * GET /api/v1/users
 * List all users with pagination and filtering (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const authResult = await requirePermission(authHeader, "users:view");

    if ("error" in authResult) {
      return authResult.status === 401
        ? unauthorizedResponse(authResult.error)
        : forbiddenResponse(authResult.error);
    }

    const searchParams = request.nextUrl.searchParams;
    const { limit, cursor } = parsePaginationParams(request);

    const roleFilter = searchParams.get("role") as UserRole | null;
    const searchQuery = searchParams.get("search")?.toLowerCase() || null;

    if (!searchQuery) {
      const cacheKey = generateCacheKey(
        "/api/v1/users",
        Object.fromEntries(searchParams.entries())
      );

      const cached = cache.get(cacheKey);
      if (cached) {
        logger.debug("Cache hit", { cacheKey });
        return NextResponse.json(cached, { status: 200 });
      }
    }

    let query: FirebaseFirestore.Query = adminDb.collection("users");

    if (roleFilter) {
      query = query.where("role", "==", roleFilter);
    }

    if (cursor) {
      const cursorDoc = await adminDb.collection("users").doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.orderBy("__name__").startAfter(cursorDoc);
      }
    } else {
      query = query.orderBy("__name__");
    }

    const snapshot = await query.limit(limit + 1).get();

    if (snapshot.empty) {
      return successResponse([], 200, { total: 0, hasMore: false });
    }

    const docs = snapshot.docs;
    const hasMore = docs.length > limit;
    const resultDocs = hasMore ? docs.slice(0, limit) : docs;
    const nextCursor = hasMore ? resultDocs[resultDocs.length - 1].id : undefined;

    let users = resultDocs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    }));

    if (searchQuery) {
      users = users.filter((user: any) => {
        const email = (user.email || "").toLowerCase();
        const displayName = (user.displayName || "").toLowerCase();
        return email.includes(searchQuery) || displayName.includes(searchQuery);
      });
    }

    const enrichedUsers = await Promise.all(
      users.map(async (user: any) => {
        try {
          const authUser = await adminAuth.getUser(user.uid);
          return {
            ...user,
            emailVerified: authUser.emailVerified,
            photoURL: authUser.photoURL || user.photoURL,
            createdAt: authUser.metadata.creationTime,
            lastSignIn: authUser.metadata.lastSignInTime,
          };
        } catch (error) {
          logger.warn("User not found in Firebase Auth", { uid: user.uid });
          return user;
        }
      })
    );

    const result = {
      data: enrichedUsers,
      total: enrichedUsers.length,
      hasMore,
      ...(nextCursor ? { nextCursor } : {}),
    };

    if (!searchQuery) {
      const cacheKey = generateCacheKey(
        "/api/v1/users",
        Object.fromEntries(searchParams.entries())
      );
      cache.set(cacheKey, result, DEFAULT_CACHE_TTL);
    }

    return successResponse(enrichedUsers, 200, {
      total: enrichedUsers.length,
      hasMore,
      ...(nextCursor ? { nextCursor } : {}),
    });
  } catch (error) {
    logger.error("GET users failed", { error: (error as Error).message });
    return serverErrorResponse("Failed to fetch users");
  }
}

/**
 * PUT /api/v1/users
 * Update user role (admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    // Verify permission
    const authHeader = request.headers.get("authorization");
    const authResult = await requirePermission(authHeader, "users:manage");

    if ("error" in authResult) {
      return authResult.status === 401
        ? unauthorizedResponse(authResult.error)
        : forbiddenResponse(authResult.error);
    }

    const body = await request.json();
    const validation = updateUserRoleSchema.safeParse(body);

    if (!validation.success) {
      return badRequestResponse(validation.error.message, validation.error.flatten());
    }

    const { uid, role } = validation.data;

    try {
      await adminAuth.getUser(uid);
    } catch (error) {
      return notFoundResponse("User");
    }

    await setUserRole(uid, role);

    try {
      await adminDb.collection("users").doc(uid).set(
        { role, updatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch (error) {
      logger.warn("Failed to update Firestore profile", { uid, error: (error as Error).message });
    }

    logger.info("User role updated", {
      uid,
      role,
      updatedBy: authResult.uid,
    });

    return successResponse({
      message: `User role updated to ${role} successfully`,
      uid,
      role,
    });
  } catch (error) {
    logger.error("PUT update user role failed", { error: (error as Error).message });
    return serverErrorResponse("Failed to update user role");
  }
}

/**
 * DELETE /api/v1/users?id=<uid>
 * Delete a user (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const authResult = await requirePermission(authHeader, "users:manage");

    if ("error" in authResult) {
      return authResult.status === 401
        ? unauthorizedResponse(authResult.error)
        : forbiddenResponse(authResult.error);
    }

    const searchParams = request.nextUrl.searchParams;
    const uid = searchParams.get("id");

    if (!uid) {
      return badRequestResponse("User ID is required");
    }

    if (uid === authResult.uid) {
      return forbiddenResponse("Cannot delete your own account");
    }

    try {
      await adminAuth.getUser(uid);
    } catch (error) {
      return notFoundResponse("User");
    }

    await adminAuth.deleteUser(uid);

    try {
      await adminDb.collection("users").doc(uid).delete();
    } catch (error) {
      logger.warn("Failed to delete Firestore profile", { uid, error: (error as Error).message });
    }

    logger.info("User deleted", {
      uid,
      deletedBy: authResult.uid,
    });

    return successResponse({
      message: "User deleted successfully",
      uid,
    });
  } catch (error) {
    logger.error("DELETE user failed", { error: (error as Error).message });
    return serverErrorResponse("Failed to delete user");
  }
}
