import { NextRequest } from "next/server";

export interface PaginationParams {
  limit: number;
  cursor?: string;
}

export interface PaginationResult {
  hasMore: boolean;
  nextCursor?: string;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export function parsePaginationParams(request: NextRequest): PaginationParams {
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10), MAX_LIMIT);
  const cursor = searchParams.get("cursor") || undefined;

  return { limit: Math.max(limit, 1), cursor };
}

export function buildPaginationResult<T>(
  items: T[],
  requestedLimit: number,
): { items: T[] } & PaginationResult {
  const hasMore = items.length > requestedLimit;
  const resultItems = hasMore ? items.slice(0, requestedLimit) : items;
  const nextCursor: string | undefined = hasMore && resultItems.length > 0
    ? (resultItems[resultItems.length - 1] as any).id || undefined
    : undefined;

  return {
    items: resultItems,
    hasMore,
    ...(nextCursor ? { nextCursor } : {}),
  };
}

// Build Firestore startAfter query using cursor
export async function applyCursor<T>(
  query: FirebaseFirestore.CollectionReference | FirebaseFirestore.Query,
  cursor: string,
  collectionName: string,
): Promise<FirebaseFirestore.Query> {
  const doc = await (query as FirebaseFirestore.CollectionReference).doc(cursor).get();

  if (!doc.exists) {
    throw new Error(`Cursor document '${cursor}' not found`);
  }

  return (query as FirebaseFirestore.CollectionReference).orderBy("__name__").startAfter(doc);
}
