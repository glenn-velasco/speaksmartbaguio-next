"use client";

import { Button, Flex, Text, IconButton } from "@radix-ui/themes";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  hasMore: boolean;
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

export function Pagination({
  hasMore,
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  loading = false,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalPages <= 1) return null;

  const maxVisible = 5;
  const pages: (number | "ellipsis-start" | "ellipsis-end")[] = [];

  if (totalPages <= maxVisible + 2) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);

    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);

    if (currentPage <= 3) {
      end = Math.min(maxVisible, totalPages - 1);
    } else if (currentPage >= totalPages - 2) {
      start = Math.max(2, totalPages - maxVisible + 1);
    }

    if (start > 2) pages.push("ellipsis-start");
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (end < totalPages - 1) pages.push("ellipsis-end");

    if (!pages.includes(totalPages)) pages.push(totalPages);
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

      {pages.map((page) => {
        if (page === "ellipsis-start" || page === "ellipsis-end") {
          return (
            <Text key={page} size="2" color="gray" style={{ width: 32, textAlign: "center" }}>
              …
            </Text>
          );
        }

        const isActive = page === currentPage;

        return (
          <Button
            key={page}
            variant={isActive ? "solid" : "soft"}
            color={isActive ? "indigo" : "gray"}
            size="2"
            disabled={loading}
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