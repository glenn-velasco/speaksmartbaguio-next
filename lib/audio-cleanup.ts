/**
 * Audio file cleanup utilities
 * Automatically delete old audio files when tts_url is changed
 */

import { deleteFromStorage } from "@/lib/storage";
import { adminDb } from "@/lib/firebase-admin";

/**
 * Check if a URL is from our storage (S3 or Firebase)
 */
function isOurStorageUrl(url: string): boolean {
  // Check for S3/CDN URLs
  const s3Endpoint = process.env.S3_ENDPOINT;
  const cdnUrl = process.env.S3_CDN_URL;
  
  if (s3Endpoint && url.includes(s3Endpoint)) return true;
  if (cdnUrl && url.includes(cdnUrl)) return true;
  
  // Check for Firebase Storage URLs
  const firebaseBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (firebaseBucket && url.includes(firebaseBucket)) return true;
  if (url.includes("firebasestorage.googleapis.com")) return true;
  
  // Check for firebase:// protocol
  if (url.startsWith("firebase://")) return true;
  
  return false;
}

/**
 * Extract storage key from URL
 */
function extractKeyFromUrl(url: string): string | null {
  try {
    // Handle firebase:// protocol
    if (url.startsWith("firebase://")) {
      return url.replace("firebase://", "");
    }

    // Handle regular URLs
    const parsedUrl = new URL(url);
    
    // For S3/CDN URLs, the path is the key
    if (parsedUrl.pathname && parsedUrl.pathname !== "/") {
      // Remove leading slash
      return parsedUrl.pathname.substring(1);
    }

    return null;
  } catch {
    // If URL parsing fails, try to extract from string
    return null;
  }
}

/**
 * Delete old audio file when tts_url is changed
 * Call this before updating with new tts_url
 * 
 * @param collection - Collection name (dictionary, phrasebook)
 * @param itemId - Item ID
 * @param oldTtsUrl - Old audio URL to delete
 * @returns Whether deletion was attempted
 */
export async function cleanupOldAudioFile(
  collection: string,
  itemId: string,
  oldTtsUrl: string
): Promise<{ success: boolean; message: string }> {
  try {

    if (!oldTtsUrl) {
      return { success: true, message: "No old URL to delete" };
    }

    if (!isOurStorageUrl(oldTtsUrl)) {

      return { success: true, message: "External URL, skipping deletion" };
    }

    const key = extractKeyFromUrl(oldTtsUrl);
    
    if (!key) {
      console.warn(`Could not extract key from URL: ${oldTtsUrl}`);
      return { success: false, message: "Could not extract storage key" };
    }

    const result = await deleteFromStorage(key);

    if (result.success) {
      return { success: true, message: `Deleted old audio file: ${key}` };
    } else {
      return { success: false, message: `Failed to delete old file` };
    }
  } catch (error) {
    console.error("Error cleaning up old audio file:", error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : "Unknown error during cleanup" 
    };
  }
}

/**
 * Batch cleanup utility - delete audio files for multiple items
 * Useful for migrations or bulk operations
 */
export async function batchCleanupAudioFiles(
  collection: string,
  itemIds: string[]
): Promise<{ total: number; success: number; failed: number }> {
  const results = { total: itemIds.length, success: 0, failed: 0 };

  for (const itemId of itemIds) {
    try {
      const doc = await adminDb.collection(collection).doc(itemId).get();
      
      if (doc.exists) {
        const data = doc.data();
        if (data?.tts_url) {
          const cleanup = await cleanupOldAudioFile(collection, itemId, data.tts_url);
          if (cleanup.success) {
            results.success++;
          } else {
            results.failed++;
          }
        }
      }
    } catch (error) {
      console.error(`Failed to cleanup ${itemId}:`, error);
      results.failed++;
    }
  }

  return results;
}

/**
 * Get audio file usage statistics
 * Track storage usage across collections
 */
export async function getAudioStorageStats(): Promise<{
  dictionary: { count: number; withAudio: number };
  phrasebook: { count: number; withAudio: number };
  translations: { count: number; withAudio: number };
}> {
  const stats = {
    dictionary: { count: 0, withAudio: 0 },
    phrasebook: { count: 0, withAudio: 0 },
    translations: { count: 0, withAudio: 0 },
  };

  const collections: Array<"dictionary" | "phrasebook" | "translations"> = ["dictionary", "phrasebook", "translations"];

  for (const collection of collections) {
    const snapshot = await adminDb.collection(collection).get();
    stats[collection].count = snapshot.size;
    
    snapshot.forEach((doc) => {
      if (doc.data()?.tts_url) {
        stats[collection].withAudio++;
      }
    });
  }

  return stats;
}
