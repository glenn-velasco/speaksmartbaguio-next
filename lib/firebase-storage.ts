import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, getMetadata } from "firebase/storage";
import { app } from "@/lib/firebase";

// Firebase Storage instance
let storageInstance: ReturnType<typeof getStorage> | null = null;

export function getFirebaseStorage() {
  if (!storageInstance) {
    storageInstance = getStorage(app);
  }
  return storageInstance;
}

/**
 * Upload a file to Firebase Storage
 * @param file - The file blob to upload
 * @param path - The storage path (e.g., "audio/dictionary/item123/file.mp3")
 * @returns Download URL of the uploaded file
 */
export async function uploadToFirebaseStorage(
  file: Buffer | Blob,
  path: string,
  contentType?: string
): Promise<string> {
  const storage = getFirebaseStorage();
  const storageRef = ref(storage, path);

  const metadata = contentType ? { contentType } : undefined;
  
  // Upload the file
  const snapshot = await uploadBytes(storageRef, file, metadata);
  
  // Get the download URL
  const downloadURL = await getDownloadURL(snapshot.ref);
  
  return downloadURL;
}

/**
 * Generate a Firebase Storage download URL from path
 * @param path - The storage path
 * @returns Download URL
 */
export async function getFirebaseStorageDownloadUrl(path: string): Promise<string> {
  const storage = getFirebaseStorage();
  const storageRef = ref(storage, path);
  return getDownloadURL(storageRef);
}

/**
 * Delete a file from Firebase Storage
 * @param path - The storage path to delete
 */
export async function deleteFromFirebaseStorage(path: string): Promise<void> {
  const storage = getFirebaseStorage();
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
}

/**
 * Generate a unique Firebase Storage key for audio files
 * @param collection - The collection name (dictionary, phrasebook)
 * @param itemId - The item ID
 * @param originalFilename - Original filename
 * @returns Formatted storage path
 */
export function generateFirebaseAudioKey(
  collection: string,
  itemId: string,
  originalFilename: string
): string {
  const timestamp = Date.now();
  const extension = originalFilename.split(".").pop() || "mp3";
  return `audio/${collection}/${itemId}/${timestamp}.${extension}`;
}

/**
 * Check if Firebase Storage is configured
 */
export function isFirebaseStorageConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
}
