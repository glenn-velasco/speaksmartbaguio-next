/**
 * Unified Storage Abstraction Layer
 * Supports S3 (IDrive E2), Dropbox, and Firebase Storage
 * Configurable via STORAGE_BACKEND environment variable
 */

import {
  isS3Configured,
  generateAudioKey as generateS3Key,
  generateUploadPresignedUrl,
  generateAccessPresignedUrl,
  deleteS3File,
  getS3CDNUrl,
} from "@/lib/s3-client";
import {
  isDropboxConfigured,
  generateAudioKey as generateDropboxKey,
  uploadToDropbox,
  getDropboxTemporaryLink,
  deleteDropboxFile,
  isStaleDropboxUrl,
  findDropboxKeyForItem,
} from "@/lib/dropbox-client";
import { adminDb } from "@/lib/firebase-admin";
import {
  isFirebaseStorageConfigured,
  generateFirebaseAudioKey,
  uploadToFirebaseStorage,
  deleteFromFirebaseStorage,
} from "@/lib/firebase-storage";

export type StorageBackend = "s3" | "dropbox" | "firebase";

export interface StorageUploadResult {
  url: string;
  key: string;
  backend: StorageBackend;
}

export interface PresignedUploadUrlResult {
  uploadUrl: string;
  accessUrl: string;
  key: string;
  backend: StorageBackend;
}

export interface StorageDeleteResult {
  success: boolean;
  backend: StorageBackend;
}

/**
 * Determine which storage backend to use
 * Priority: s3 > dropbox > firebase > error
 */
export function getActiveStorageBackend(): StorageBackend {
  const preferred = process.env.STORAGE_BACKEND || "auto";

  if (preferred === "s3") {
    if (!isS3Configured()) {
      throw new Error("S3 storage is preferred but not configured. Please set S3_ACCESS_KEY_ID, S3_ACCESS_KEY_SECRET, S3_BUCKET_NAME, and S3_ENDPOINT");
    }
    return "s3";
  }

  if (preferred === "dropbox") {
    if (!isDropboxConfigured()) {
      throw new Error("Dropbox storage is preferred but not configured. Please set DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, and DROPBOX_APP_SECRET");
    }
    return "dropbox";
  }

  if (preferred === "firebase") {
    if (!isFirebaseStorageConfigured()) {
      throw new Error("Firebase storage is preferred but not configured. Please set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
    }
    return "firebase";
  }

  // Auto mode: try S3 first, then Dropbox, then Firebase
  if (isS3Configured()) {
    return "s3";
  }

  if (isDropboxConfigured()) {
    return "dropbox";
  }

  if (isFirebaseStorageConfigured()) {
    return "firebase";
  }

  throw new Error("No storage backend configured. Please configure S3, Dropbox, or Firebase Storage");
}

/**
 * Transform a document's tts_url field from a storage key to a playable URL.
 * Returns the document unchanged if there is no tts_url or transformation fails.
 */
export async function transformDocumentTtsUrl<T extends { id: string; [key: string]: unknown }>(
  doc: T,
  collection?: string
): Promise<T> {
  const ttsUrl = doc.tts_url;

  if (ttsUrl && typeof ttsUrl === "string") {
    try {
      if (collection && isStaleDropboxUrl(ttsUrl)) {
        const recoveredKey = await findDropboxKeyForItem(collection, doc.id);
        if (recoveredKey) {
          await adminDb.collection(collection).doc(doc.id).update({
            tts_url: `dropbox://${recoveredKey}`,
          });
          const freshUrl = await getDropboxTemporaryLink(recoveredKey);
          return { ...doc, tts_url: freshUrl };
        }
        console.warn(`Stale Dropbox URL for ${collection}/${doc.id}: no file found in folder, leaving as-is.`);
        return doc;
      }

      const transformedUrl = await transformStorageKeyToUrl(ttsUrl);
      return { ...doc, tts_url: transformedUrl };
    } catch (error) {
      console.warn(`Failed to transform tts_url for ${doc.id}:`, error instanceof Error ? error.message : error);
      return doc;
    }
  }

  return doc;
}

/**
 * Generate a presigned upload URL
 * Returns upload URL, access URL, and file key
 * 
 * @param collection - Collection name (dictionary, phrasebook)
 * @param itemId - Item ID
 * @param filename - Original filename
 * @param contentType - MIME type
 * @param expiresIn - URL expiry seconds
 */
export async function generatePresignedUploadUrl(
  collection: string,
  itemId: string,
  filename: string,
  contentType: string,
  expiresIn: number = parseInt(process.env.AUDIO_UPLOAD_EXPIRY_SECONDS || "604800")
): Promise<PresignedUploadUrlResult> {
  const backend = getActiveStorageBackend();

  if (backend === "s3") {
    const key = generateS3Key(collection, itemId, filename);
    const uploadUrl = await generateUploadPresignedUrl(key, contentType, expiresIn);

    // Generate access URL (with CDN if configured)
    const cdnUrl = getS3CDNUrl();
    const accessUrl = cdnUrl ? `${cdnUrl}/${key}` : await generateAccessPresignedUrl(key, expiresIn);

    return {
      uploadUrl,
      accessUrl,
      key,
      backend: "s3",
    };
  }

  // For Dropbox, server-side upload is needed (no presigned URL support)
  if (backend === "dropbox") {
    const key = generateDropboxKey(collection, itemId, filename);

    return {
      uploadUrl: "dropbox://upload",
      accessUrl: `dropbox://${key}`,
      key,
      backend: "dropbox",
    };
  }

  // For Firebase, we return a special marker URL format
  // The client will need to upload via a different mechanism
  const key = generateFirebaseAudioKey(collection, itemId, filename);

  // For Firebase Storage, we'll use a server-side upload approach
  // Return a placeholder that indicates server upload is needed
  return {
    uploadUrl: `firebase://${key}`,
    accessUrl: `firebase://${key}`,
    key,
    backend: "firebase",
  };
}

/**
 * Upload a file directly to storage (server-side)
 * Used for Dropbox and Firebase backends
 * 
 * @param file - File buffer
 * @param key - Storage key/path
 * @param contentType - MIME type
 */
export async function uploadToStorage(
  file: Buffer,
  key: string,
  contentType: string
): Promise<StorageUploadResult> {
  const backend = getActiveStorageBackend();

  if (backend === "dropbox") {
    const storageKey = await uploadToDropbox(key, file, contentType);
    const accessUrl = await getDropboxTemporaryLink(storageKey);
    return {
      url: accessUrl,
      key: storageKey,
      backend: "dropbox",
    };
  }

  if (backend === "firebase") {
    const downloadUrl = await uploadToFirebaseStorage(file, key, contentType);
    return {
      url: downloadUrl,
      key,
      backend: "firebase",
    };
  }

  // For S3, this shouldn't be called (use presigned URLs instead)
  // But if it is, we can generate a presigned URL and upload server-side
  throw new Error("Direct server-side upload not supported for S3. Use presigned URLs instead.");
}

/**
 * Transform a storage key to a fresh access URL
 * Used for S3 and Dropbox keys that need fresh URLs on each request
 * This solves the issue where presigned URLs expire
 * 
 * @param key - Storage key (e.g., "audio/dictionary/123/file.mp3")
 * @param expiresIn - Presigned URL expiry in seconds (default 3600)
 */
export async function transformStorageKeyToUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {

  if (key.startsWith("http://") || key.startsWith("https://")) {
    return key;
  }

  if (key.startsWith("firebase://")) {
    const actualKey = key.replace("firebase://", "");
    const { getFirebaseStorageDownloadUrl } = await import("@/lib/firebase-storage");
    return getFirebaseStorageDownloadUrl(actualKey);
  }

  if (key.startsWith("dropbox://")) {
    const actualKey = key.replace("dropbox://", "");
    return getDropboxTemporaryLink(actualKey);
  }

  // S3 key (no protocol prefix)
  if (isS3Configured()) {
    const cdnUrl = getS3CDNUrl();
    if (cdnUrl) {
      return `${cdnUrl}/${key}`;
    }
    return generateAccessPresignedUrl(key, expiresIn);
  }

  throw new Error(`Cannot transform storage key to URL: no matching backend for key "${key}" and S3 is not configured.`);
}

/**
 * Delete a file from storage
 * 
 * @param key - Storage key or URL
 * @param backend - Storage backend
 */
export async function deleteFromStorage(
  key: string,
  backend?: StorageBackend
): Promise<StorageDeleteResult> {
  try {
    const actualBackend = backend || getActiveStorageBackend();

    if (actualBackend === "s3") {
      await deleteS3File(key);
      return { success: true, backend: "s3" };
    }

    if (actualBackend === "dropbox") {
      let storageKey = key;
      if (key.startsWith("dropbox://")) {
        storageKey = key.replace("dropbox://", "");
      } else if (key.startsWith("http")) {
        throw new Error("Cannot delete Dropbox file from a temporary link URL. Pass the storage key (e.g. \"/audio/...\") or a \"dropbox://\" prefixed value.");
      }
      await deleteDropboxFile(storageKey);
      return { success: true, backend: "dropbox" };
    }

    if (actualBackend === "firebase") {
      let storageKey = key;
      if (key.startsWith("http")) {
        const url = new URL(key);
        storageKey = url.pathname.substring(1); 
        storageKey = decodeURIComponent(storageKey);
      } else if (key.startsWith("firebase://")) {
        storageKey = key.replace("firebase://", "");
      }

      await deleteFromFirebaseStorage(storageKey);
      return { success: true, backend: "firebase" };
    }

    return { success: false, backend: actualBackend };
  } catch (error) {
    console.error(`Failed to delete file from storage: ${error}`);
    return { success: false, backend: (backend || "s3") as StorageBackend };
  }
}

/**
 * Generate a storage key for audio files
 * 
 * @param collection - Collection name
 * @param itemId - Item ID
 * @param filename - Original filename
 */
export function generateAudioKey(
  collection: string,
  itemId: string,
  filename: string
): string {
  const backend = getActiveStorageBackend();

  if (backend === "s3") {
    return generateS3Key(collection, itemId, filename);
  }

  if (backend === "dropbox") {
    return generateDropboxKey(collection, itemId, filename);
  }

  return generateFirebaseAudioKey(collection, itemId, filename);
}

/**
 * Check if any storage backend is configured
 */
export function isStorageConfigured(): boolean {
  return isS3Configured() || isDropboxConfigured() || isFirebaseStorageConfigured();
}
