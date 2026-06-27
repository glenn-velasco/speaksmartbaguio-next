import { NextRequest } from "next/server";
import { requireEditorOrAdmin } from "@/lib/auth-server";
import { badRequestResponse, successResponse, errorResponse, notFoundResponse } from "@/lib/response";
import { isStorageConfigured, getActiveStorageBackend } from "@/lib/storage";
import { adminDb } from "@/lib/firebase-admin";
import { revalidateTag } from "next/cache";
import { cleanupOldAudioFile } from "@/lib/audio-cleanup";
import { z } from "zod";

const completeUploadSchema = z.object({
  collection: z.enum(["dictionary", "phrasebook", "translations"]),
  itemId: z.string().min(1),
  key: z.string().min(1),
  accessUrl: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const authResult = await requireEditorOrAdmin(authHeader);

    if ("error" in authResult) {
      return errorResponse(authResult.status, authResult.error);
    }

    if (!isStorageConfigured()) {
      return errorResponse(500, "Storage is not configured.");
    }

    const body = await request.json();
    const validation = completeUploadSchema.safeParse(body);

    if (!validation.success) {
      return badRequestResponse("Invalid request body", validation.error.message);
    }

    const { collection, itemId, key, accessUrl } = validation.data;

    const docRef = adminDb.collection(collection).doc(itemId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return notFoundResponse(`${collection} item`);
    }

    const oldData = doc.data();
    const oldTtsUrl = oldData?.tts_url;

    if (oldTtsUrl) {
      
      const cleanupResult = await cleanupOldAudioFile(collection, itemId, oldTtsUrl, key);
      if (!cleanupResult.success) {
        console.warn(`Cleanup warning: ${cleanupResult.message}`);
      }
    }

    const backend = getActiveStorageBackend();

    let ttsUrlToStore: string;

    if (backend === "s3") {
      ttsUrlToStore = key;
    } else if (backend === "dropbox") {
      ttsUrlToStore = `dropbox://${key}`;
    } else if (backend === "firebase") {
      let finalUrl = accessUrl;
      if (!finalUrl || finalUrl.startsWith("firebase://") || finalUrl.startsWith("/")) {
        const { transformStorageKeyToUrl } = await import("@/lib/storage");
        finalUrl = await transformStorageKeyToUrl(key);
      }
      ttsUrlToStore = finalUrl;
    } else {
      ttsUrlToStore = key;
    }

    await docRef.update({
      tts_url: ttsUrlToStore,
      updated_at: new Date().toISOString(),
    });

    revalidateTag(collection, 'max');

    return successResponse({
      success: true,
      audioUrl: ttsUrlToStore,
      message: oldTtsUrl ? "Upload completed and old file deleted" : "Upload completed successfully",
      oldFileDeleted: !!oldTtsUrl,
    });
  } catch (error) {
    console.error("Upload completion error:", error);
    return errorResponse(500, "Failed to complete upload", "INTERNAL_ERROR", error);
  }
}
