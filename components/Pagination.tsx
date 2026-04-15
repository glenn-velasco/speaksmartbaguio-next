"use client";

import { Button, Flex, Text, IconButton } from "@radix-ui/themes";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  hasMore: boolean;
  currentPage: number;
  totalDiscoveredPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

export function Pagination({
  hasMore,
  currentPage,
  totalDiscoveredPages,
  onPageChange,
  loading = false,
}: PaginationProps) {
  // Don't show pagination if only 1 page and no more
  if (totalDiscoveredPages <= 1 && !hasMore) return null;

  // Build the page numbers to display
  const maxVisible = 5;
  const pages: (number | "ellipsis-start" | "ellipsis-end")[] = [];
  const totalPages = hasMore ? totalDiscoveredPages + 1 : totalDiscoveredPages;

  if (totalPages <= maxVisible + 2) {
    // Show all pages if few enough
    for (let i = 1; i <= totalDiscoveredPages; i++) {
      pages.push(i);
    }
    if (hasMore) pages.push(totalDiscoveredPages + 1);
  } else {
    // Always show first page
    pages.push(1);

    // Calculate window around current page
    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);

    // Adjust window size
    if (currentPage <= 3) {
      end = Math.min(maxVisible, totalPages - 1);
    } else if (currentPage >= totalPages - 2) {
      start = Math.max(2, totalPages - maxVisible + 1);
    }

    if (start > 2) pages.push("ellipsis-start");
    for (let i = start; i <= end; i++) {
      if (i <= totalDiscoveredPages || (hasMore && i === totalDiscoveredPages + 1)) {
        pages.push(i);
      }
    }
    if (end < totalPages - 1) pages.push("ellipsis-end");

    // Always show last known page
    if (totalPages > 1) {
      const lastPage = hasMore ? totalDiscoveredPages + 1 : totalDiscoveredPages;
      if (!pages.includes(lastPage)) pages.push(lastPage);
    }
  }

  return (
    <Flex justify="center" align="center" gap="1" py="6">
      <IconButton
        variant="soft"
        color="gray"
        size="2"
        disabled={currentPage <= 1 || loading}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft className="w-4 h-4" />
      </IconButton>

      {pages.map((page, idx) => {
        if (page === "ellipsis-start" || page === "ellipsis-end") {
          return (
            <Text key={page} size="2" color="gray" style={{ width: 32, textAlign: "center" }}>
              …
            </Text>
          );
        }

        const isActive = page === currentPage;
        // Can only navigate to pages we have cursors for, or the next undiscovered page
        const isNavigable = page <= totalDiscoveredPages || (hasMore && page === totalDiscoveredPages + 1);

        return (
          <Button
            key={page}
            variant={isActive ? "solid" : "soft"}
            color={isActive ? "indigo" : "gray"}
            size="2"
            disabled={loading || !isNavigable}
            onClick={() => onPageChange(page)}
            style={{ minWidth: 36 }}
          >
            {page}
          </Button>
        );
      })}

      <IconButton
        variant="soft"
        color="gray"
        size="2"
        disabled={!hasMore || loading}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <ChevronRight className="w-4 h-4" />
      </IconButton>
    </Flex>
  );
}
