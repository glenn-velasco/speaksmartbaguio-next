import { NextResponse } from "next/server";

interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

interface ApiSuccess<T> {
  data: T;
  message?: string;
  total?: number;
  hasMore?: boolean;
  nextCursor?: string;
}

export function errorResponse(status: number, error: string, code?: string, details?: unknown): NextResponse<ApiError> {
  const body: ApiError = { error, code };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status });
}

export function successResponse<T>(data: T, status = 200, extras?: Partial<Omit<ApiSuccess<T>, "data">>): NextResponse<ApiSuccess<T>> {
  const body: ApiSuccess<T> = { data, ...extras };
  return NextResponse.json(body, { status });
}

export function notFoundResponse(resource: string): NextResponse<ApiError> {
  return errorResponse(404, `${resource} not found`, "NOT_FOUND");
}

export function badRequestResponse(message: string, details?: unknown): NextResponse<ApiError> {
  return errorResponse(400, message, "BAD_REQUEST", details);
}

export function conflictResponse(message: string): NextResponse<ApiError> {
  return errorResponse(409, message, "CONFLICT");
}

export function unauthorizedResponse(message = "Unauthorized"): NextResponse<ApiError> {
  return errorResponse(401, message, "UNAUTHORIZED");
}

export function forbiddenResponse(message = "Forbidden"): NextResponse<ApiError> {
  return errorResponse(403, message, "FORBIDDEN");
}

export function serverErrorResponse(message = "Internal server error"): NextResponse<ApiError> {
  return errorResponse(500, message, "INTERNAL_ERROR");
}
