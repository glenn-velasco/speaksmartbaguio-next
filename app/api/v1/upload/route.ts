import { NextRequest } from "next/server";
import { requireEditorOrAdmin } from "@/lib/auth-server";
import { badRequestResponse, successResponse, errorResponse } from "@/lib/response";
import { generatePresignedUploadUrl, isStorageConfigured } from "@/lib/storage";
import { z } from "zod";

const uploadRequestSchema = z.object({
  collection: z.enum(["dictionary", "phrasebook", "translations"]),
  itemId: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const authResult = await requireEditorOrAdmin(authHeader);

    if ("error" in authResult) {
      return errorResponse(authResult.status, authResult.error);
    }

    if (!isStorageConfigured()) {
      return errorResponse(500, "Storage is not configured. Please configure S3 or Firebase Storage.");
    }

    const body = await request.json();
    const validation = uploadRequestSchema.safeParse(body);

    if (!validation.success) {
      return badRequestResponse("Invalid request body", validation.error.message);
    }

    const { collection, itemId, filename, contentType } = validation.data;

    const result = await generatePresignedUploadUrl(collection, itemId, filename, contentType);

    return successResponse({
      uploadUrl: result.uploadUrl,
      accessUrl: result.accessUrl,
      key: result.key,
      backend: result.backend,
    });
  } catch (error) {
    console.error("Upload URL generation error:", error);
    return errorResponse(500, "Failed to generate upload URL", "INTERNAL_ERROR", error);
  }
}
