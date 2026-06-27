"use server";

import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { revalidatePath, revalidateTag } from "next/cache";
import { AuthenticatedUser, verifyToken, invalidatePermissionsCache } from "@/lib/auth-server";
import { setUserRole } from "@/lib/admin-roles";
import { UserRole } from "@/lib/user-roles";
import { generateSearchFields } from "./search-utils";
import { logger } from "@/lib/logger";
import { transformDocumentTtsUrl } from "@/lib/storage";

export type SubmissionAction = "create" | "update" | "delete";
export type CollectionType = "dictionary" | "phrasebook" | "translations" | "roles";

const COLLECTION_CONFIG: Record<CollectionType, {
  uniqueField?: string;
  searchableFields: string[];
}> = {
  dictionary: {
    uniqueField: "ilokanoWord",
    searchableFields: ["ilokanoWord", "englishTranslation", "tagalogTranslation"],
  },
  phrasebook: {
    uniqueField: "ilokanoWord",
    searchableFields: ["ilokanoWord", "englishTranslation", "tagalogTranslation"],
  },
  translations: {
    uniqueField: "ilokano",
    searchableFields: ["ilokano", "english", "tagalog"],
  },
  roles: {
    uniqueField: undefined,
    searchableFields: [],
  },
};

const MAX_BATCH_SIZE = 500;
export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface SubmissionData {
  collection: CollectionType;
  action: SubmissionAction;
  targetId?: string;
  data: Record<string, unknown>;
  reason?: string;
}

const FIELD_LABELS: Record<string, string> = {
  ilokanoWord: "Ilokano word",
  englishTranslation: "English translation",
  tagalogTranslation: "Tagalog translation",
  partOfSpeech: "Part of speech",
  category: "Category",
  tts_url: "TTS audio URL",
  english: "English",
  ilokano: "Ilokano",
  tagalog: "Tagalog",
  role: "Role",
};

function cleanAuditData(data?: Record<string, unknown> | null): Record<string, unknown> {
  if (!data) return {};

  return Object.fromEntries(
    Object.entries(data).filter(([key, value]) => (
      !key.startsWith("_") &&
      value !== undefined &&
      typeof value !== "function"
    ))
  );
}

function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(empty)";
  if (Array.isArray(value)) return value.map(formatAuditValue).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function quoteAuditValue(value: unknown): string {
  const formatted = formatAuditValue(value);
  return formatted === "(empty)" ? formatted : `"${formatted}"`;
}

function getAuditItemName(data?: Record<string, unknown> | null): string {
  const source = cleanAuditData(data);
  const value = source.ilokanoWord || source.ilokano || source.english || source.englishTranslation || source.role;
  return value ? `"${formatAuditValue(value)}"` : "item";
}

function formatAuditFields(data?: Record<string, unknown> | null): string[] {
  const clean = cleanAuditData(data);
  return Object.entries(clean).map(([key, value]) => {
    const label = FIELD_LABELS[key] || key;
    return `${label}: ${formatAuditValue(value)}`;
  });
}

function buildAuditText(args: {
  collection: CollectionType;
  action: SubmissionAction;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
}): string {
  const collectionLabel = args.collection.charAt(0).toUpperCase() + args.collection.slice(1);
  const beforeData = cleanAuditData(args.beforeData);
  const afterData = cleanAuditData(args.afterData);

  if (args.action === "delete") {
    return [
      `Deleted ${getAuditItemName(beforeData)} from ${collectionLabel}.`,
      "Deleted item details:",
      ...formatAuditFields(beforeData).map((line) => `- ${line}`),
    ].join("\n");
  }

  if (args.action === "create") {
    return [
      `Created ${getAuditItemName(afterData)} in ${collectionLabel}.`,
      "Created data:",
      ...formatAuditFields(afterData).map((line) => `- ${line}`),
    ].join("\n");
  }

  const changedLines = Object.keys({ ...beforeData, ...afterData })
    .filter((key) => !key.startsWith("_"))
    .filter((key) => formatAuditValue(beforeData[key]) !== formatAuditValue(afterData[key]))
    .map((key) => {
      const label = FIELD_LABELS[key] || key;
      return `- ${label} changed from ${quoteAuditValue(beforeData[key])} to ${quoteAuditValue(afterData[key])}`;
    });

  return [
    `Updated ${getAuditItemName(afterData) || getAuditItemName(beforeData)} in ${collectionLabel}.`,
    changedLines.length > 0 ? "Changed fields:" : "Changed fields: none",
    ...changedLines,
  ].join("\n");
}

async function getExistingSubmissionTarget(submission: SubmissionData): Promise<Record<string, unknown> | null> {
  if (!submission.targetId || submission.action === "create") return null;
  if (submission.collection === "roles") {
    const user = await adminAuth.getUser(submission.targetId);
    const role = (user.customClaims as { role?: UserRole } | undefined)?.role || "viewer";
    return {
      email: user.email || "",
      displayName: user.displayName || "",
      role,
    };
  }

  const doc = await adminDb.collection(submission.collection).doc(submission.targetId).get();
  return doc.exists ? cleanAuditData(doc.data() as Record<string, unknown>) : null;
}

async function enrichSubmissionForAudit(submission: SubmissionData) {
  const beforeData = await getExistingSubmissionTarget(submission);
  const afterData = submission.action === "delete"
    ? beforeData || cleanAuditData(submission.data)
    : cleanAuditData(submission.data);

  return {
    ...submission,
    data: afterData,
    beforeData,
    afterData,
    auditText: buildAuditText({
      collection: submission.collection,
      action: submission.action,
      beforeData,
      afterData,
    }),
  };
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

    invalidatePermissionsCache(role as UserRole);

    revalidatePath("/dashboard");
    return { success: true, message: `Permissions for ${role} updated successfully` };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update permissions";
    return { success: false, error: message };
  }
}

export async function createSubmission(submission: SubmissionData, authToken: string): Promise<{ success: boolean; id?: string; itemId?: string; message?: string; error?: string }> {
  try {

    const user = await getAuthenticatedUser(authToken);

    if (!user) {
      return { success: false, error: "Authentication required. Please log in." };
    }

    const auditSubmission = await enrichSubmissionForAudit(submission);
    const submissionData = {
      ...auditSubmission,
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create submission";
    return { success: false, error: message };
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

    const auditSubmission = await enrichSubmissionForAudit(submission);
    const submissionData = {
      ...auditSubmission,
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


    revalidatePath("/dashboard");

    revalidatePath(`/${submission.collection}`);

    if (itemId) {

      revalidatePath(`/${submission.collection}/${itemId}`);

      revalidatePath(`/${submission.collection}/${itemId}/edit`);

    }
    return { success: true, id: docRef.id, itemId: itemId || undefined, message: "Changes saved successfully" };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save changes";
    return { success: false, error: message };
  }
}

interface UniquenessCheckResult {
  ok: boolean;
  error?: string;
  duplicateField?: string;
  duplicateValue?: string;
}

async function checkBatchUniqueness(
  collection: CollectionType,
  items: Record<string, unknown>[],
  options?: { checkPendingSubmissions?: boolean }
): Promise<UniquenessCheckResult> {
  const config = COLLECTION_CONFIG[collection];
  if (!config?.uniqueField) return { ok: true };

  const uniqueValues = items.map((item) => item[config.uniqueField!]).filter(Boolean) as string[];
  if (uniqueValues.length === 0) return { ok: true };

  const normalizedValues = uniqueValues.map((v) => v.trim().toLowerCase());
  const uniqueBatchValues = new Set(normalizedValues);
  if (uniqueBatchValues.size !== normalizedValues.length) {
    const duplicates = uniqueValues.filter((value, index) => normalizedValues.indexOf(normalizedValues[index]) !== index);
    return { ok: false, error: `Duplicate ${config.uniqueField} within batch: "${duplicates[0]}"`, duplicateField: config.uniqueField!, duplicateValue: duplicates[0] };
  }

  const existingValues = new Set<string>();
  const FIRESTORE_IN_LIMIT = 30;

  for (let i = 0; i < normalizedValues.length; i += FIRESTORE_IN_LIMIT) {
    const chunk = normalizedValues.slice(i, i + FIRESTORE_IN_LIMIT);
    const existingDocs = await adminDb.collection(collection).where(config.uniqueField, "in", chunk).get();
    for (const doc of existingDocs.docs) {
      existingValues.add(doc.get(config.uniqueField!).trim().toLowerCase());
    }
  }

  if (options?.checkPendingSubmissions) {
    const pendingDocs = await adminDb
      .collection("submissions")
      .where("collection", "==", collection)
      .where("status", "==", "pending")
      .get();
    for (const doc of pendingDocs.docs) {
      const fieldValue = doc.data().data?.[config.uniqueField!];
      if (fieldValue) {
        existingValues.add((fieldValue as string).trim().toLowerCase());
      }
    }
  }

  for (let i = 0; i < items.length; i++) {
    const fieldValue = (items[i][config.uniqueField!] as string || "").trim().toLowerCase();
    if (fieldValue && existingValues.has(fieldValue)) {
      return { ok: false, error: `Duplicate ${config.uniqueField}: "${uniqueValues[i]}" already exists`, duplicateField: config.uniqueField!, duplicateValue: uniqueValues[i] };
    }
  }

  return { ok: true };
}

export async function batchDirectCreateAction(
  collection: CollectionType,
  items: Record<string, unknown>[],
  authToken: string
): Promise<{ success: boolean; createdIds: string[]; count: number; message: string; error?: string; duplicateField?: string; duplicateValue?: string }> {
  try {
    const user = await getAuthenticatedUser(authToken);
    if (!user) {
      return { success: false, createdIds: [], count: 0, error: "Authentication required", message: "Authentication required" };
    }
    if (user.role !== "admin") {
      return { success: false, createdIds: [], count: 0, error: "Admin privileges required", message: "Admin privileges required" };
    }

    if (!items || items.length === 0) {
      return { success: false, createdIds: [], count: 0, error: "No items provided", message: "No items provided" };
    }

    if (items.length > MAX_BATCH_SIZE) {
      return { success: false, createdIds: [], count: 0, error: `Maximum ${MAX_BATCH_SIZE} items per batch`, message: `Maximum ${MAX_BATCH_SIZE} items per batch` };
    }

    const config = COLLECTION_CONFIG[collection];
    if (!config) {
      return { success: false, createdIds: [], count: 0, error: "Invalid collection", message: "Invalid collection" };
    }

    const uniqueness = await checkBatchUniqueness(collection, items);
    if (!uniqueness.ok) {
      return { success: false, createdIds: [], count: 0, error: uniqueness.error!, message: uniqueness.error!, duplicateField: uniqueness.duplicateField, duplicateValue: uniqueness.duplicateValue };
    }

    const batch = adminDb.batch();
    const createdIds: string[] = [];

    for (const item of items) {
      const docData = { ...item };
      if (config.searchableFields.length > 0) {
        docData._search = generateSearchFields(docData as Record<string, unknown>, config.searchableFields);
      }

      const docRef = adminDb.collection(collection).doc();
      batch.create(docRef, docData);
      createdIds.push(docRef.id);
    }

    await batch.commit();

    const auditBatch = adminDb.batch();
    for (let i = 0; i < createdIds.length; i++) {
      const afterData = cleanAuditData(items[i]);
      const submissionData = {
        collection,
        action: "create" as SubmissionAction,
        targetId: createdIds[i],
        data: afterData,
        beforeData: null,
        afterData,
        auditText: buildAuditText({
          collection,
          action: "create",
          afterData,
        }),
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName,
        status: "approved" as SubmissionStatus,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        adminNote: "Auto-approved (admin direct create)",
        reviewedBy: user.uid,
        reviewedByEmail: user.email,
        reviewedByName: user.displayName,
        reviewedAt: new Date().toISOString(),
      };
      const submissionRef = adminDb.collection("submissions").doc();
      auditBatch.set(submissionRef, submissionData);
    }
    await auditBatch.commit();

    revalidateTag(collection, 'max');
    revalidatePath(`/${collection}`);

    return { success: true, createdIds, count: createdIds.length, message: `${createdIds.length} ${collection} entries created successfully` };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : `Failed to batch create ${collection} entries`;
    return { success: false, createdIds: [], count: 0, error: message, message };
  }
}

/**
 * Batch create pending submissions for non-admin users.
 * Each item becomes a separate pending submission for admin review.
 * Uses Firestore batch for atomic writes.
 */
export async function batchCreateSubmissions(
  collection: CollectionType,
  items: Record<string, unknown>[],
  authToken: string
): Promise<{ success: boolean; createdIds: string[]; count: number; message: string; error?: string; duplicateField?: string; duplicateValue?: string }> {
  try {
    const user = await getAuthenticatedUser(authToken);
    if (!user) {
      return { success: false, createdIds: [], count: 0, error: "Authentication required. Please log in.", message: "Authentication required. Please log in." };
    }

    if (!items || items.length === 0) {
      return { success: false, createdIds: [], count: 0, error: "No items provided", message: "No items provided" };
    }

    if (items.length > MAX_BATCH_SIZE) {
      return { success: false, createdIds: [], count: 0, error: `Maximum ${MAX_BATCH_SIZE} items per batch`, message: `Maximum ${MAX_BATCH_SIZE} items per batch` };
    }

    const uniqueness = await checkBatchUniqueness(collection, items, { checkPendingSubmissions: true });
    if (!uniqueness.ok) {
      return { success: false, createdIds: [], count: 0, error: uniqueness.error!, message: uniqueness.error!, duplicateField: uniqueness.duplicateField, duplicateValue: uniqueness.duplicateValue };
    }

    const batch = adminDb.batch();
    const createdIds: string[] = [];

    for (const item of items) {
      const afterData = cleanAuditData(item);
      const submissionData = {
        collection,
        action: "create" as SubmissionAction,
        data: afterData,
        beforeData: null,
        afterData,
        auditText: buildAuditText({
          collection,
          action: "create",
          afterData,
        }),
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

      const docRef = adminDb.collection("submissions").doc();
      batch.set(docRef, submissionData);
      createdIds.push(docRef.id);
    }

    await batch.commit();

    revalidatePath("/dashboard");
    return { success: true, createdIds, count: createdIds.length, message: `${createdIds.length} submissions created for admin review` };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : `Failed to create ${collection} submissions`;
    return { success: false, createdIds: [], count: 0, error: message, message };
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
  } catch (error: unknown) {
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
        
        const itemId = await applySubmission(submission as unknown as AppliedSubmission);
        
        revalidateTag(submission.collection, 'max');

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
      } catch (applyError: unknown) {
        const message = applyError instanceof Error ? applyError.message : "Unknown error";
        return { success: false, error: "Failed to apply submission: " + message };
      }
    }

    revalidatePath("/dashboard");
    return { success: true, message: "Submission rejected successfully" };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to review submission";
    return { success: false, error: message };
  }
}

export async function getDictionaryItems(partOfSpeech?: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = adminDb.collection("dictionary");
    
    if (partOfSpeech && partOfSpeech !== "all") {
      query = query.where("partOfSpeech", "==", partOfSpeech);
    }

    const snapshot = await query.limit(100).get();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    const data = { id: doc.id, ...doc.data() };
    return await transformDocumentTtsUrl(data, collection);
  } catch (error) {
    console.error(`Failed to get ${collection} document:`, error);
    return null;
  }
}

export async function getItemById(collection: string, id: string) {
  
  return getDocumentById(collection, id);
}

interface AppliedSubmission {
  collection: CollectionType;
  action: SubmissionAction;
  targetId?: string;
  data: Record<string, unknown>;
  [key: string]: unknown;
}

async function applySubmission(submission: AppliedSubmission): Promise<string | null> {
  const { collection, action, targetId, data } = submission;

  if (collection === "roles" && action === "update") {
    if (targetId && data.role) {
      await setUserRole(targetId, data.role as UserRole);
      try {
        await adminDb.collection("users").doc(targetId).update({ role: data.role });
      } catch {

      }
    }
    return targetId || null;
  }

  let itemId: string | null = null;
  const searchableFields = COLLECTION_CONFIG[collection]?.searchableFields || [];
  const applyData: Record<string, unknown> = { ...data };
  if (searchableFields.length > 0 && action !== "delete") {
    applyData._search = generateSearchFields(applyData, searchableFields);
  }

  switch (action) {
    case "create": {
      const docRef = await adminDb.collection(collection).add(applyData);
      itemId = docRef.id;
      break;
    }
    case "update": {
      if (targetId) {
        await adminDb.collection(collection).doc(targetId).update(applyData);
        itemId = targetId;
      }
      break;
    }
    case "delete": {
      if (targetId) {
        const docRef = adminDb.collection(collection).doc(targetId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          logger.info("Deleting document", {
            collection,
            data: docSnap.data(),
          });
        }
        await docRef.delete();
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
    const allUsers: Array<{
      uid: string;
      email: string | undefined;
      displayName: string | undefined;
      photoURL: string | undefined;
      emailVerified: boolean | undefined;
      createdAt: string | undefined;
      lastSignIn: string | undefined;
    }> = [];
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
      })));
      pageToken = listUsersResult.pageToken;
    } while (pageToken);

    const roleMap = new Map<string, UserRole>();
    
    if (allUsers.length > 0) {
      const uids = allUsers.map(u => u.uid);
      const getUsersResult = await adminAuth.getUsers(
        uids.map(uid => ({ uid }))
      );
      for (const u of getUsersResult.users) {
        const claims = u.customClaims as { role?: UserRole } | null;
        roleMap.set(u.uid, claims?.role || "viewer");
      }
    }

    let users = allUsers.map(user => ({
      ...user,
      role: roleMap.get(user.uid) || "viewer" as UserRole,
    }));

    if (options?.searchQuery) {
      const searchQuery = options.searchQuery.toLowerCase();
      users = users.filter((user) => {
        const email = (user.email || "").toLowerCase();
        const displayName = (user.displayName || "").toLowerCase();
        return email.includes(searchQuery) || displayName.includes(searchQuery);
      });
    }

    return users;
  } catch (error: unknown) {
    console.error("Failed to get users:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to get users: ${message}`);
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
    } catch {
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/users");

    return {
      success: true,
      message: `User role updated to ${newRole}`,
      uid: targetUserId,
      role: newRole,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update user role";
    return { success: false, error: message };
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
    } catch {
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/users");

    return {
      success: true,
      message: "User deleted successfully",
      uid: targetUserId,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete user";
    return { success: false, error: message };
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
  } catch (error: unknown) {
    console.error("Failed to get role requests:", error);
    return [];
  }
}
