import { NextRequest } from "next/server";

export interface PaginationParams {
  limit: number;
  page: number;
}

export interface PaginationResult {
  hasMore: boolean;
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export function parsePaginationParams(request: NextRequest): PaginationParams {
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10), MAX_LIMIT);
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);

  return { limit: Math.max(limit, 1), page };
}
