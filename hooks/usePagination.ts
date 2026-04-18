"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const PAGE_PARAM = "page";

function getPageFromUrl(searchParams: URLSearchParams): number {
  const raw = searchParams.get(PAGE_PARAM);
  const parsed = raw ? parseInt(raw, 10) : 1;
  return isNaN(parsed) || parsed < 1 ? 1 : parsed;
}

function getPageFromStorage(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed >= 1) return parsed;
    }
  } catch {
    // localStorage may be unavailable
  }
  return 1;
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

  const initialPage = getPageFromUrl(searchParams) || getPageFromStorage(storageKey);
  const [currentPage, setCurrentPage] = useState(initialPage);

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(page);
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

  // Sync currentPage when URL changes (e.g. browser back/forward, or external navigation)
  useEffect(() => {
    const pageFromUrl = getPageFromUrl(searchParams);
    setCurrentPage(pageFromUrl);
    setPageToStorage(storageKey, pageFromUrl);
  }, [searchParams, storageKey]);

  // Handle browser back/forward (popstate) — covers cases where Next.js doesn't re-render
  useEffect(() => {
    const handlePopState = () => {
      const pageFromUrl = getPageFromUrl(new URLSearchParams(window.location.search));
      setCurrentPage(pageFromUrl);
      setPageToStorage(storageKey, pageFromUrl);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [storageKey]);

  return { currentPage, goToPage };
}
