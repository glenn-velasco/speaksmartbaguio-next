/**
 * Unified Storage Abstraction Layer
 * Supports both S3 (IDrive E2) and Firebase Storage
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
  isFirebaseStorageConfigured,
  generateFirebaseAudioKey,
  uploadToFirebaseStorage,
  deleteFromFirebaseStorage,
} from "@/lib/firebase-storage";

export type StorageBackend = "s3" | "firebase";

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
 * Priority: s3 > firebase > error
 */
export function getActiveStorageBackend(): StorageBackend {
  const preferred = process.env.STORAGE_BACKEND || "auto";

  if (preferred === "s3") {
    if (!isS3Configured()) {
      throw new Error("S3 storage is preferred but not configured. Please set S3_ACCESS_KEY_ID, S3_ACCESS_KEY_SECRET, S3_BUCKET_NAME, and S3_ENDPOINT");
    }
    return "s3";
  }

  if (preferred === "firebase") {
    if (!isFirebaseStorageConfigured()) {
      throw new Error("Firebase storage is preferred but not configured. Please set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
    }
    return "firebase";
  }

  // Auto mode: try S3 first, fallback to Firebase
  if (isS3Configured()) {
    return "s3";
  }

  if (isFirebaseStorageConfigured()) {
    return "firebase";
  }

  throw new Error("No storage backend configured. Please configure either S3 or Firebase Storage");
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
 * Upload a file directly to Firebase Storage (server-side)
 * This is needed because Firebase doesn't support presigned URLs like S3
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
 * Get the public access URL for a stored file
 * 
 * @param key - Storage key or URL
 * @param backend - Storage backend
 * @param expiresIn - Presigned URL expiry (for S3)
 */
export async function getAccessUrl(
  key: string,
  backend?: StorageBackend,
  expiresIn: number = 3600
): Promise<string> {
  // If it's already a full URL (Firebase download URL), return as-is
  if (key.startsWith("http://") || key.startsWith("https://")) {
    return key;
  }

  // If it's a firebase:// marker, we need to generate the URL
  if (key.startsWith("firebase://")) {
    const actualKey = key.replace("firebase://", "");
    const { getFirebaseStorageDownloadUrl } = await import("@/lib/firebase-storage");
    return getFirebaseStorageDownloadUrl(actualKey);
  }

  // For S3, check if CDN is configured
  if (backend === "s3" || !backend) {
    const cdnUrl = getS3CDNUrl();
    if (cdnUrl) {
      return `${cdnUrl}/${key}`;
    }

    // Generate presigned URL
    return generateAccessPresignedUrl(key, expiresIn);
  }

  throw new Error(`Cannot generate access URL for key: ${key}`);
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
    // Determine backend
    const actualBackend = backend || getActiveStorageBackend();

    if (actualBackend === "s3") {
      await deleteS3File(key);
      return { success: true, backend: "s3" };
    }

    if (actualBackend === "firebase") {
      // Extract key from Firebase URL if needed
      let storageKey = key;
      if (key.startsWith("http")) {
        // Extract path from Firebase download URL
        const url = new URL(key);
        storageKey = url.pathname.substring(1); // Remove leading /
        // Decode URL-encoded characters
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

  return generateFirebaseAudioKey(collection, itemId, filename);
}

/**
 * Check if any storage backend is configured
 */
export function isStorageConfigured(): boolean {
  return isS3Configured() || isFirebaseStorageConfigured();
}
