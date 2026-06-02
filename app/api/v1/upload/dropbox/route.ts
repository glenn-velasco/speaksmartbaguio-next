import { NextRequest } from "next/server";
import { requireEditorOrAdmin } from "@/lib/auth-server";
import { successResponse, errorResponse, badRequestResponse } from "@/lib/response";
import { isStorageConfigured, getActiveStorageBackend, generateAudioKey } from "@/lib/storage";
import { uploadToDropbox, getDropboxTemporaryLink } from "@/lib/dropbox-client";
import { z } from "zod";

const MAX_FILE_SIZE = (parseInt(process.env.MAX_AUDIO_FILE_SIZE_MB || "50") * 1024 * 1024);

const dropboxUploadSchema = z.object({
  collection: z.enum(["dictionary", "phrasebook", "translations"]),
  itemId: z.string().min(1),
  filename: z.string().min(1),
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

    const backend = getActiveStorageBackend();
    if (backend !== "dropbox") {
      return errorResponse(400, "This endpoint is only for Dropbox uploads.");
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const collection = formData.get("collection");
    const itemId = formData.get("itemId");
    const filename = formData.get("filename");

    if (!file) {
      return badRequestResponse("Missing 'file' in form data");
    }

    const parsed = dropboxUploadSchema.safeParse({ collection, itemId, filename });
    if (!parsed.success) {
      return badRequestResponse("Missing or invalid 'collection', 'itemId', or 'filename' in form data", parsed.error.message);
    }

    if (file.size > MAX_FILE_SIZE) {
      return badRequestResponse(`File size exceeds maximum of ${process.env.MAX_AUDIO_FILE_SIZE_MB || 50}MB`);
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const storageKey = generateAudioKey(parsed.data.collection, parsed.data.itemId, parsed.data.filename);
    const uploadedKey = await uploadToDropbox(storageKey, fileBuffer, file.type);
    const accessUrl = await getDropboxTemporaryLink(uploadedKey);

    return successResponse({
      key: uploadedKey,
      accessUrl,
    });
  } catch (error) {
    console.error("Dropbox upload error:", error);
    return errorResponse(500, "Failed to upload to Dropbox", "INTERNAL_ERROR", error instanceof Error ? error.message : String(error));
  }
}
