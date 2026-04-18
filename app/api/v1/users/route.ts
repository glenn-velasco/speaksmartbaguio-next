import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { z } from "zod";
import { logger } from "@/lib/logger";
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

interface UserData {
  uid: string;
  email?: string;
  displayName?: string;
  role: string;
  emailVerified?: boolean;
  photoURL?: string | null;
  createdAt?: string;
  lastSignIn?: string;
}

const updateUserRoleSchema = z.object({
  uid: z.string().min(1, "User ID is required"),
  role: z.enum(["admin", "editor", "viewer"]),
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
    const { limit, page } = parsePaginationParams(request);
    const offset = (page - 1) * limit;

    const roleFilter = searchParams.get("role") as UserRole | null;
    const searchQuery = searchParams.get("search")?.toLowerCase() || null;

    let query: FirebaseFirestore.Query = adminDb.collection("users");

    if (roleFilter) {
      query = query.where("role", "==", roleFilter);
    }

    query = query.orderBy("__name__").offset(offset).limit(limit + 1);

    const snapshot = await query.get();

    if (snapshot.empty) {
      const countQuery = adminDb.collection("users");
      const countFilter = roleFilter ? countQuery.where("role", "==", roleFilter) : countQuery;
      const countSnapshot = await countFilter.get();
      return successResponse([], 200, { total: 0, totalCount: countSnapshot.size, hasMore: false });
    }

    const docs = snapshot.docs;
    const hasMore = docs.length > limit;
    const resultDocs = hasMore ? docs.slice(0, limit) : docs;

    let users = resultDocs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    })) as UserData[];

    if (searchQuery) {
      users = users.filter((user: UserData) => {
        const email = (user.email || "").toLowerCase();
        const displayName = (user.displayName || "").toLowerCase();
        return email.includes(searchQuery) || displayName.includes(searchQuery);
      });
    }

    const enrichedUsers = await Promise.all(
      users.map(async (user: UserData) => {
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

    const countQuery = adminDb.collection("users");
    const countFilter = roleFilter ? countQuery.where("role", "==", roleFilter) : countQuery;
    const countSnapshot = await countFilter.get();
    const totalCount = countSnapshot.size;

    return successResponse(enrichedUsers, 200, {
      total: enrichedUsers.length,
      totalCount,
      hasMore,
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
    } catch {
      return notFoundResponse("User");
    }

    await setUserRole(uid, role);

    try {
      await adminDb.collection("users").doc(uid).set(
        { role, updatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch {
      logger.warn("Failed to update Firestore profile", { uid });
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
    } catch {
      return notFoundResponse("User");
    }

    await adminAuth.deleteUser(uid);

    try {
      await adminDb.collection("users").doc(uid).delete();
    } catch {
      logger.warn("Failed to delete Firestore profile", { uid });
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
