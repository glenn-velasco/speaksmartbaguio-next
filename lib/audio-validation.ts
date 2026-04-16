/**
 * Audio file validation utilities
 */

export interface AudioValidationResult {
  valid: boolean;
  errors: string[];
  metadata?: AudioMetadata;
}

export interface AudioMetadata {
  size: number;
  type: string;
  name: string;
  duration?: number;
}

// Allowed audio formats
export const ALLOWED_AUDIO_FORMATS = (process.env.ALLOWED_AUDIO_FORMATS || "mp3,wav,ogg,m4a,flac").split(",");

// Max file size in MB (default: 50MB)
export const MAX_AUDIO_FILE_SIZE_MB = parseInt(process.env.MAX_AUDIO_FILE_SIZE_MB || "50");

// Max file size in bytes
export const MAX_AUDIO_FILE_SIZE_BYTES = MAX_AUDIO_FILE_SIZE_MB * 1024 * 1024;

/**
 * Validate audio file on the client side
 * Checks file type, size, and basic format
 */
export function validateAudioFile(file: File): AudioValidationResult {
  const errors: string[] = [];

  // Check file type
  const extension = file.name.split(".").pop()?.toLowerCase();
  const mimeType = file.type;

  const isAllowedFormat = ALLOWED_AUDIO_FORMATS.some(format => {
    return extension === format || mimeType.includes(format);
  });

  if (!isAllowedFormat) {
    errors.push(`Invalid file format. Allowed formats: ${ALLOWED_AUDIO_FORMATS.join(", ").toUpperCase()}`);
  }

  // Check file size
  if (file.size > MAX_AUDIO_FILE_SIZE_BYTES) {
    errors.push(`File too large. Maximum size: ${MAX_AUDIO_FILE_SIZE_MB}MB`);
  }

  // Check file is not empty
  if (file.size === 0) {
    errors.push("File is empty");
  }

  return {
    valid: errors.length === 0,
    errors,
    metadata: {
      size: file.size,
      type: file.type,
      name: file.name,
    },
  };
}

/**
 * Validate audio file on the server side
 * Checks file size, type, and can be extended for duration/bitrates checks
 */
export function validateAudioFileServer(
  fileSize: number,
  fileName: string,
  contentType?: string
): AudioValidationResult {
  const errors: string[] = [];

  // Check file type
  const extension = fileName.split(".").pop()?.toLowerCase();
  const isAllowedFormat = ALLOWED_AUDIO_FORMATS.some(format => {
    return extension === format || (contentType && contentType.includes(format));
  });

  if (!isAllowedFormat) {
    errors.push(`Invalid file format. Allowed formats: ${ALLOWED_AUDIO_FORMATS.join(", ").toUpperCase()}`);
  }

  // Check file size
  if (fileSize > MAX_AUDIO_FILE_SIZE_BYTES) {
    errors.push(`File too large. Maximum size: ${MAX_AUDIO_FILE_SIZE_MB}MB`);
  }

  // Check file is not empty
  if (fileSize === 0) {
    errors.push("File is empty");
  }

  return {
    valid: errors.length === 0,
    errors,
    metadata: {
      size: fileSize,
      type: contentType || "unknown",
      name: fileName,
    },
  };
}

/**
 * Get audio duration using Web Audio API (client-side only)
 * Returns duration in seconds
 */
export async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        resolve(audioBuffer.duration);
        audioContext.close();
      } catch {
        reject(new Error("Failed to decode audio file"));
      }
    };

    reader.onerror = () => reject(new Error("Failed to read audio file"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Validate audio file with duration check (client-side)
 */
export async function validateAudioFileWithDuration(
  file: File,
  maxDurationSeconds?: number
): Promise<AudioValidationResult> {
  const basicValidation = validateAudioFile(file);

  if (!basicValidation.valid) {
    return basicValidation;
  }

  try {
    const duration = await getAudioDuration(file);
    
    // Optional: check if audio is too short (e.g., less than 0.1 seconds)
    if (duration < 0.1) {
      basicValidation.errors.push("Audio file is too short (less than 0.1 seconds)");
    }

    // Optional: check if audio is too long (e.g., more than 10 minutes)
    const maxDuration = maxDurationSeconds || 600; // Default: 10 minutes
    if (duration > maxDuration) {
      basicValidation.errors.push(`Audio file is too long (maximum ${maxDuration / 60} minutes)`);
    }

    basicValidation.metadata = {
      ...basicValidation.metadata!,
      duration,
    };
  } catch (error) {
    // If we can't decode duration, still allow the file if basic validation passed
    console.warn("Could not determine audio duration:", error);
  }

  return {
    valid: basicValidation.errors.length === 0,
    errors: basicValidation.errors,
    metadata: basicValidation.metadata,
  };
}

/**
 * Get MIME type from file extension
 */
export function getMimeTypeFromExtension(filename: string): string | undefined {
  const extension = filename.split(".").pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    flac: "audio/flac",
  };

  return extension ? mimeTypes[extension] : undefined;
}

/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Format duration to MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
