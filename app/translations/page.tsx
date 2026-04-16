"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { fetchAPI } from "@/lib/fetch-api";
import { Flex, Heading, Text, Button, Card, Spinner, Container, Box, TextField, Separator } from "@radix-ui/themes";
import { Pagination } from "@/components/Pagination";
import { Search } from "lucide-react";

const ITEMS_PER_PAGE = 12;

interface TranslationItem {
  id: string;
  english: string;
  ilokano: string;
  tagalog: string;
}

export default function TranslationsPage() {
  const { user, hasPermission } = useAuth();
  const [items, setItems] = useState<TranslationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const cursorMap = useRef<Record<number, string | undefined>>({ 1: undefined });

  const fetchPage = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(ITEMS_PER_PAGE) });
      const cursor = cursorMap.current[page];
      if (cursor) {
        params.set("cursor", cursor);
      }
      if (searchTerm) {
        params.set("ilokano", searchTerm.replace(/\*/g, "") + "*");
      }

      const result = await fetchAPI(`/api/v1/translations?${params}`);
      setItems(result.data || []);
      setHasMore(result.hasMore || false);

      if (result.nextCursor) {
        cursorMap.current[page + 1] = result.nextCursor;
      }
    } catch (error) {
      console.error("Failed to fetch translations:", error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    cursorMap.current = { 1: undefined };
    setCurrentPage(1);
    fetchPage(1);
  }, [fetchPage, searchTerm]);

  function handlePageChange(page: number) {
    setCurrentPage(page);
    fetchPage(page);
  }

  const totalDiscoveredPages = Math.max(...Object.keys(cursorMap.current).map(Number));

  return (
    <Box minHeight="100vh">
      <Container size="4" px="4" py="6">
        <Flex justify="between" align="start" mb="4">
          <Box>
            <Heading size="7" mb="1" highContrast>Translations</Heading>
            <Text color="gray" size="3">Direct word translations between languages</Text>
          </Box>
          {hasPermission("translations:create") && (
            <Button asChild size="2">
              <Link href={`/translations/new${searchTerm ? `?translation=${encodeURIComponent(searchTerm)}` : ''}`}>
                Add Translation
              </Link>
            </Button>
          )}
        </Flex>

        <Box mb="5">
          <TextField.Root
            placeholder="Search translations..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            size="3"
          >
            <TextField.Slot>
              <Search className="w-4 h-4" />
            </TextField.Slot>
          </TextField.Root>
        </Box>

        {loading ? (
          <Flex justify="center" py="9">
            <Spinner size="3" />
          </Flex>
        ) : items.length === 0 ? (
          <Flex justify="center" py="9">
            <Text color="gray">No translations found</Text>
          </Flex>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => (
                <Link key={item.id} href={`/translations/${item.id}`} style={{ textDecoration: "none" }}>
                  <Card size="2" style={{ cursor: "pointer" }} className="transition-shadow hover:shadow-lg">
                    <Flex direction="column" gap="3">
                      <Box>
                        <Text size="1" color="gray">English</Text>
                        <Text size="4" weight="medium" highContrast as="p">{item.english}</Text>
                      </Box>
                      <Separator size="4" />
                      <Box>
                        <Text size="1" color="gray">Ilokano</Text>
                        <Text size="4" weight="medium" color="indigo" as="p">{item.ilokano}</Text>
                      </Box>
                      <Separator size="4" />
                      <Box>
                        <Text size="1" color="gray">Tagalog</Text>
                        <Text size="4" weight="medium" color="green" as="p">{item.tagalog}</Text>
                      </Box>
                    </Flex>
                  </Card>
                </Link>
              ))}
            </div>

            <Pagination
              hasMore={hasMore}
              currentPage={currentPage}
              totalDiscoveredPages={totalDiscoveredPages}
              onPageChange={handlePageChange}
              loading={loading}
            />
          </>
        )}
      </Container>
    </Box>
  );
}
