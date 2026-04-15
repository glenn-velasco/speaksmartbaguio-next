"use server";

import { adminDb } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";
import { requireAuth, requireAdmin, AuthenticatedUser, verifyToken } from "@/lib/auth-server";
import { setUserRole } from "@/lib/admin-roles";

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

export async function createSubmission(submission: SubmissionData, authToken: string) {
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
export async function createAndAutoApproveSubmission(submission: SubmissionData, authToken: string) {
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

    // Apply the change immediately
    await applySubmission(submissionData);

    revalidatePath("/dashboard");
    revalidatePath(`/${submission.collection}`);
    if (submission.targetId) {
      revalidatePath(`/${submission.collection}/${submission.targetId}`);
      revalidatePath(`/${submission.collection}/${submission.targetId}/edit`);
    }
    return { success: true, id: docRef.id, message: "Changes saved successfully" };
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
    // Require admin role
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
    // Require admin role
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
      await applySubmission(submission);
    }

    revalidatePath("/dashboard");
    return { success: true, message: `Submission ${action === "approve" ? "approved" : "rejected"} successfully` };
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

async function applySubmission(submission: any) {
  const { collection, action, targetId, data } = submission;

  if (collection === "roles" && action === "update") {
    if (targetId && data.role) {
      await setUserRole(targetId, data.role);
      // Optional: Update the user's document in Firestore if it exists
      try {
        await adminDb.collection("users").doc(targetId).update({ role: data.role });
      } catch (e) {
        // Ignored if user profile doesn't exist
      }
    }
    return;
  }

  switch (action) {
    case "create": {
      await adminDb.collection(collection).add(data);
      break;
    }
    case "update": {
      if (targetId) {
        await adminDb.collection(collection).doc(targetId).update(data);
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
}
