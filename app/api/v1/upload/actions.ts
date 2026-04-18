"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import {
  generatePresignedUploadUrl,
  transformStorageKeyToUrl,
  uploadToStorage,
  isStorageConfigured,
  getActiveStorageBackend,
} from "@/lib/storage";
import { validateAudioFileServer } from "@/lib/audio-validation";
import { adminDb } from "@/lib/firebase-admin";

export interface GenerateUploadUrlResult {
  success: boolean;
  uploadUrl: string;
  accessUrl: string;
  key: string;
  error?: string;
}

export interface CompleteUploadResult {
  success: boolean;
  audioUrl: string;
  error?: string;
}

export async function generateUploadUrlAction(
  collection: string,
  itemId: string,
  filename: string,
  contentType: string
): Promise<GenerateUploadUrlResult> {
  try {
    if (!isStorageConfigured()) {
      return {
        success: false,
        uploadUrl: "",
        accessUrl: "",
        key: "",
        error: "Storage is not configured. Please configure S3 or Firebase Storage.",
      };
    }

    if (!collection || !itemId || !filename || !contentType) {
      return {
        success: false,
        uploadUrl: "",
        accessUrl: "",
        key: "",
        error: "Missing required parameters",
      };
    }

    const result = await generatePresignedUploadUrl(collection, itemId, filename, contentType);

    return {
      success: true,
      uploadUrl: result.uploadUrl,
      accessUrl: result.accessUrl,
      key: result.key,
    };
  } catch (error) {
    console.error("Failed to generate upload URL:", error);
    return {
      success: false,
      uploadUrl: "",
      accessUrl: "",
      key: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function completeUploadAction(
  collection: string,
  itemId: string,
  key: string,
  accessUrl: string
): Promise<CompleteUploadResult> {
  try {
    if (!collection || !itemId || !key || !accessUrl) {
      return {
        success: false,
        audioUrl: "",
        error: "Missing required parameters",
      };
    }

    const backend = getActiveStorageBackend();
    let ttsUrlToStore: string;

    if (backend === "s3") {
      ttsUrlToStore = key;
    } else if (backend === "firebase") {
      let finalUrl = accessUrl;
      if (accessUrl.startsWith("firebase://") || accessUrl.startsWith("/")) {
        finalUrl = await transformStorageKeyToUrl(key);
      }
      ttsUrlToStore = finalUrl;
    } else {
      ttsUrlToStore = key;
    }

    const docRef = adminDb.collection(collection).doc(itemId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return {
        success: false,
        audioUrl: "",
        error: `${collection} item ${itemId} not found`,
      };
    }

    await docRef.update({
      tts_url: ttsUrlToStore,
      updated_at: new Date().toISOString(),
    });

    revalidateTag(collection, 'max');

    revalidatePath(`/${collection}`);
    revalidatePath(`/${collection}/${itemId}`);

    return {
      success: true,
      audioUrl: ttsUrlToStore,
    };
  } catch (error) {
    console.error("Failed to complete upload:", error);
    return {
      success: false,
      audioUrl: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function uploadAudioForNewItem(
  collection: string,
  itemId: string,
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<CompleteUploadResult> {
  try {
    const validation = validateAudioFileServer(fileBuffer.length, fileName, contentType);
    if (!validation.valid) {
      return {
        success: false,
        audioUrl: "",
        error: validation.errors.join(", "),
      };
    }

    const { generateAudioKey } = await import("@/lib/storage");
    const key = generateAudioKey(collection, itemId, fileName);

    const result = await uploadToStorage(fileBuffer, key, contentType);

    return {
      success: true,
      audioUrl: result.url,
    };
  } catch (error) {
    console.error("Failed to upload audio:", error);
    return {
      success: false,
      audioUrl: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
