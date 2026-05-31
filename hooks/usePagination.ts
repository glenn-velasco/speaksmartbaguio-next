"use client";

import { useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const PAGE_PARAM = "page";

function getPageFromUrl(searchParams: URLSearchParams): number {
  const raw = searchParams.get(PAGE_PARAM);
  const parsed = raw ? parseInt(raw, 10) : 1;
  return isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

function setPageToStorage(key: string, page: number) {
  try {
    localStorage.setItem(key, String(page));
  } catch {
    // localStorage may be unavailable
  }
}

export interface UsePaginationOptions {
  storageKey: string;
}

export interface UsePaginationReturn {
  currentPage: number;
  goToPage: (page: number) => void;
}

export function usePagination({
  storageKey,
}: UsePaginationOptions): UsePaginationReturn {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPage = getPageFromUrl(searchParams);

  const goToPage = useCallback(
    (page: number) => {
      setPageToStorage(storageKey, page);
      const params = new URLSearchParams(searchParams.toString());
      if (page <= 1) {
        params.delete(PAGE_PARAM);
      } else {
        params.set(PAGE_PARAM, String(page));
      }
      const query = params.toString();
      const newUrl = query ? `${pathname}?${query}` : pathname;
      router.push(newUrl, { scroll: false });
    },
    [pathname, router, searchParams, storageKey]
  );

  return { currentPage, goToPage };
}
