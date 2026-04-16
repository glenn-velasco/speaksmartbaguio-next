"use server";

import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";
import { requireAuth, requireAdmin, AuthenticatedUser, verifyToken } from "@/lib/auth-server";
import { cache } from "@/lib/cache";
import { setUserRole } from "@/lib/admin-roles";
import { UserRole } from "@/lib/user-roles";

export type SubmissionAction = "create" | "update" | "delete";
export type CollectionType = "dictionary" | "phrasebook" | "translations" | "roles";
export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface SubmissionData {
  collection: CollectionType;
  action: SubmissionAction;
  targetId?: string;
  data: any;
  reason?: string;
}

/**
 * Verify authentication from a provided token.
 * Server actions receive the token from client-side calls.
 */
async function getAuthenticatedUser(token: string): Promise<AuthenticatedUser | null> {
  try {
    const authResult = await verifyToken(token);
    
    if ("error" in authResult) {
      return null;
    }

    return authResult;
  } catch {
    return null;
  }
}

import { Permission } from "./permissions";

/**
 * Get permissions for all roles.
 */
export async function getAllRolePermissions() {
  try {
    const roles = ["admin", "editor", "viewer"];
    const results: Record<string, Permission[]> = {};

    for (const role of roles) {
      const doc = await adminDb.collection("roles").doc(role).get();
      if (doc.exists) {
        results[role] = doc.data()?.permissions || [];
      } else {
        const { DEFAULT_ROLE_PERMISSIONS } = await import("./permissions");
        results[role] = DEFAULT_ROLE_PERMISSIONS[role] || [];
      }
    }

    return results;
  } catch (error) {
    console.error("Failed to get role permissions:", error);
    return {};
  }
}

/**
 * Update permissions for a role.
 */
export async function updateRolePermissions(role: string, permissions: Permission[], authToken: string) {
  try {
    const user = await getAuthenticatedUser(authToken);

    if (!user || user.role !== "admin") {
      return { success: false, error: "Admin privileges required." };
    }

    await adminDb.collection("roles").doc(role).set({
      permissions,
      updatedAt: new Date().toISOString(),
      updatedBy: user.uid,
    }, { merge: true });

    cache.invalidate(`permissions:${role}`);

    revalidatePath("/dashboard");
    return { success: true, message: `Permissions for ${role} updated successfully` };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update permissions" };
  }
}

export async function createSubmission(submission: SubmissionData, authToken: string): Promise<{ success: boolean; id?: string; itemId?: string; message?: string; error?: string }> {
  try {

    const user = await getAuthenticatedUser(authToken);

    if (!user) {
      return { success: false, error: "Authentication required. Please log in." };
    }

    const submissionData = {
      ...submission,
      userId: user.uid,
      userEmail: user.email,
      userName: user.displayName,
      status: "pending" as SubmissionStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      adminNote: null,
      reviewedBy: null,
      reviewedAt: null,
    };

    const docRef = await adminDb.collection("submissions").add(submissionData);

    revalidatePath("/dashboard");
    return { success: true, id: docRef.id, message: "Submission created successfully" };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to create submission" };
  }
}

/**
 * Create a submission and auto-approve it for admins.
 * The submission is recorded in the dashboard for audit trail, but applied immediately.
 */
export async function createAndAutoApproveSubmission(submission: SubmissionData, authToken: string): Promise<{ success: boolean; id?: string; itemId?: string; message?: string; error?: string }> {
  try {
    const user = await getAuthenticatedUser(authToken);

    if (!user) {
      return { success: false, error: "Authentication required. Please log in." };
    }

    if (user.role !== "admin") {
      return { success: false, error: "Admin privileges required." };
    }

    const submissionData = {
      ...submission,
      userId: user.uid,
      userEmail: user.email,
      userName: user.displayName,
      status: "approved" as SubmissionStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      adminNote: "Auto-approved (admin edit)",
      reviewedBy: user.uid,
      reviewedByEmail: user.email,
      reviewedByName: user.displayName,
      reviewedAt: new Date().toISOString(),
    };

    const docRef = await adminDb.collection("submissions").add(submissionData);

    const itemId = await applySubmission(submissionData);

    console.log("[createAndAutoApproveSubmission] Applied, itemId:", itemId);

    revalidatePath("/dashboard");
    revalidatePath(`/${submission.collection}`);
    if (itemId) {
      revalidatePath(`/${submission.collection}/${itemId}`);
      revalidatePath(`/${submission.collection}/${itemId}/edit`);
    }
    return { success: true, id: docRef.id, itemId: itemId || undefined, message: "Changes saved successfully" };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to save changes" };
  }
}

/**
 * Direct CRUD operations for admins (no approval workflow)
 * Admins can create, update, and delete items directly
 */
export async function directCrudAction(
  collection: CollectionType,
  action: "create" | "update" | "delete",
  data: any,
  targetId?: string,
  authToken?: string
): Promise<{ success: boolean; id?: string; message: string; error?: string }> {
  try {
    if (authToken) {
      const user = await getAuthenticatedUser(authToken);
      if (!user) {
        return { success: false, error: "Authentication required", message: "Authentication required" };
      }
      if (user.role !== "admin") {
        return { success: false, error: "Admin privileges required", message: "Admin privileges required" };
      }
    }

    switch (action) {
      case "create": {
        const docRef = await adminDb.collection(collection).add(data);
        revalidatePath(`/${collection}`);
        revalidatePath(`/${collection}/new`);
        return { success: true, id: docRef.id, message: `${collection} entry created successfully` };
      }
      case "update": {
        if (!targetId) {
          return { success: false, error: "Target ID required for update", message: "Target ID required for update" };
        }
        await adminDb.collection(collection).doc(targetId).update(data);
        revalidatePath(`/${collection}`);
        revalidatePath(`/${collection}/${targetId}`);
        revalidatePath(`/${collection}/${targetId}/edit`);
        return { success: true, message: `${collection} entry updated successfully` };
      }
      case "delete": {
        if (!targetId) {
          return { success: false, error: "Target ID required for delete", message: "Target ID required for delete" };
        }
        await adminDb.collection(collection).doc(targetId).delete();
        revalidatePath(`/${collection}`);
        revalidatePath(`/${collection}/${targetId}`);
        return { success: true, message: `${collection} entry deleted successfully` };
      }
      default:
        return { success: false, error: "Invalid action", message: "Invalid action" };
    }
  } catch (error: any) {
    return { success: false, error: error.message || `Failed to ${action} ${collection} entry`, message: error.message || `Failed to ${action} ${collection} entry` };
  }
}

export async function getSubmissions(status?: SubmissionStatus, collection?: CollectionType) {
  try {
    let query = adminDb.collection("submissions").orderBy("createdAt", "desc");

    if (status) {
      query = query.where("status", "==", status);
    }

    if (collection) {
      query = query.where("collection", "==", collection);
    }

    const snapshot = await query.limit(100).get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error: any) {
    console.error("Failed to get submissions:", error);
    return [];
  }
}

export async function reviewSubmission(id: string, action: "approve" | "reject", authToken: string, adminNote?: string) {
  try {
    const user = await getAuthenticatedUser(authToken);
    
    if (!user) {
      return { success: false, error: "Authentication required. Please log in." };
    }

    if (user.role !== "admin") {
      return { success: false, error: "Admin privileges required to review submissions." };
    }

    const submissionDoc = await adminDb.collection("submissions").doc(id).get();

    if (!submissionDoc.exists) {
      return { success: false, error: "Submission not found" };
    }

    const submission = submissionDoc.data()!;

    if (submission.status !== "pending") {
      return { success: false, error: "Submission already reviewed" };
    }

    await adminDb.collection("submissions").doc(id).update({
      status: action === "approve" ? "approved" : "rejected",
      adminNote: adminNote || null,
      reviewedBy: user.uid,
      reviewedByEmail: user.email,
      reviewedByName: user.displayName,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (action === "approve") {
      try {
        
        const itemId = await applySubmission(submission);
        
        cache.invalidatePattern(`/api/v1/${submission.collection}`);

        revalidatePath(`/${submission.collection}`);
        
        const resolvedId = itemId || submission.targetId;

        if (resolvedId) {

          revalidatePath(`/${submission.collection}/${resolvedId}`);

          revalidatePath(`/${submission.collection}/${resolvedId}/edit`);

        }

        revalidatePath("/dashboard");
        return { 
          success: true, 
          message: `Submission ${action === "approve" ? "approved" : "rejected"} successfully`,
          itemId: itemId,
          collection: submission.collection,
          action: submission.action,
          targetId: submission.targetId
        };
      } catch (applyError: any) {

        return { success: false, error: "Failed to apply submission: " + applyError.message };
      }
    }

    revalidatePath("/dashboard");
    return { success: true, message: "Submission rejected successfully" };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to review submission" };
  }
}

export async function getDictionaryItems(partOfSpeech?: string) {
  try {
    let query: any = adminDb.collection("dictionary");
    
    if (partOfSpeech && partOfSpeech !== "all") {
      query = query.where("partOfSpeech", "==", partOfSpeech);
    }

    const snapshot = await query.limit(100).get();

    return snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Failed to get dictionary items:", error);
    return [];
  }
}

export async function getPhrasebookItems() {
  try {
    const snapshot = await adminDb.collection("phrasebook").limit(100).get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Failed to get phrasebook items:", error);
    return [];
  }
}

export async function getTranslationItems() {
  try {
    const snapshot = await adminDb.collection("translations").limit(100).get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Failed to get translation items:", error);
    return [];
  }
}

export async function getDocumentById(collection: string, id: string) {
  try {
    const doc = await adminDb.collection(collection).doc(id).get();

    if (!doc.exists) {
      return null;
    }

    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error(`Failed to get ${collection} document:`, error);
    return null;
  }
}

export async function getItemById(collection: string, id: string) {
  
  return getDocumentById(collection, id);
}

async function applySubmission(submission: any): Promise<string | null> {
  const { collection, action, targetId, data } = submission;

  if (collection === "roles" && action === "update") {
    if (targetId && data.role) {
      await setUserRole(targetId, data.role);
      try {
        await adminDb.collection("users").doc(targetId).update({ role: data.role });
      } catch (e) {

      }
    }
    return targetId;
  }

  let itemId: string | null = null;

  switch (action) {
    case "create": {
      const docRef = await adminDb.collection(collection).add(data);
      itemId = docRef.id;
      break;
    }
    case "update": {
      if (targetId) {
        await adminDb.collection(collection).doc(targetId).update(data);
        itemId = targetId;
      }
      break;
    }
    case "delete": {
      if (targetId) {
        await adminDb.collection(collection).doc(targetId).delete();
      }
      break;
    }
  }

  return itemId;
}

/**
 * Get all users with optional filtering and pagination.
 * Admin only.
 */
export async function getAllUsers(options?: {
  role?: UserRole;
  searchQuery?: string;
  limit?: number;
  cursor?: string;
}) {
  try {
    const allUsers: any[] = [];
    let pageToken: string | undefined;

    do {
      const listUsersResult = await adminAuth.listUsers(options?.limit || 100, pageToken);
      allUsers.push(...listUsersResult.users.map((user) => ({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
        createdAt: user.metadata.creationTime,
        lastSignIn: user.metadata.lastSignInTime,
        role: "viewer" as UserRole,
      })));
      pageToken = listUsersResult.pageToken;
    } while (pageToken);

    let users = allUsers;

    if (options?.searchQuery) {
      const searchQuery = options.searchQuery.toLowerCase();
      users = users.filter((user) => {
        const email = (user.email || "").toLowerCase();
        const displayName = (user.displayName || "").toLowerCase();
        return email.includes(searchQuery) || displayName.includes(searchQuery);
      });
    }

    console.log(`Loaded ${users.length} users from Authentication`);
    return users;
  } catch (error: any) {
    console.error("Failed to get users:", error);
    throw new Error(`Failed to get users: ${error.message}`);
  }
}

/**
 * Update a user's role directly (without submission workflow).
 * Admin only.
 */
export async function updateUserRoleDirect(
  targetUserId: string,
  newRole: UserRole,
  authToken: string
) {
  try {
    const user = await getAuthenticatedUser(authToken);

    if (!user) {
      return { success: false, error: "Authentication required. Please log in." };
    }

    if (user.role !== "admin") {
      return { success: false, error: "Admin privileges required." };
    }

    // Verify target user exists
    try {
      await adminAuth.getUser(targetUserId);
    } catch {
      return { success: false, error: "User not found" };
    }

    // Update custom claims
    await setUserRole(targetUserId, newRole);

    // Update Firestore profile (for display purposes)
    try {
      await adminDb.collection("users").doc(targetUserId).set(
        { role: newRole, updatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch (e) {
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/users");

    return {
      success: true,
      message: `User role updated to ${newRole}`,
      uid: targetUserId,
      role: newRole,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update user role" };
  }
}

/**
 * Delete a user account.
 * Admin only.
 */
export async function deleteUserAccount(targetUserId: string, authToken: string) {
  try {
    const user = await getAuthenticatedUser(authToken);

    if (!user) {
      return { success: false, error: "Authentication required. Please log in." };
    }

    if (user.role !== "admin") {
      return { success: false, error: "Admin privileges required." };
    }

    if (targetUserId === user.uid) {
      return { success: false, error: "Cannot delete your own account" };
    }

    try {
      await adminAuth.getUser(targetUserId);
    } catch {
      return { success: false, error: "User not found" };
    }

    await adminAuth.deleteUser(targetUserId);

    try {
      await adminDb.collection("users").doc(targetUserId).delete();
    } catch (e) {
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/users");

    return {
      success: true,
      message: "User deleted successfully",
      uid: targetUserId,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to delete user" };
  }
}

/**
 * Get pending role requests (submissions with collection="roles").
 */
/**
 * Get permissions for a specific role (client-side helper).
 */
export async function getRolePermissions(role: UserRole): Promise<Permission[]> {
  const { getPermissionsForRole } = await import("./auth-server");
  return getPermissionsForRole(role);
}

/**
 * Get pending role requests (submissions with collection="roles").
 */
export async function getRoleRequests(status?: SubmissionStatus) {
  try {
    let query = adminDb
      .collection("submissions")
      .where("collection", "==", "roles")
      .orderBy("createdAt", "desc");

    if (status) {
      query = query.where("status", "==", status);
    }

    const snapshot = await query.limit(50).get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error: any) {
    console.error("Failed to get role requests:", error);
    return [];
  }
}
