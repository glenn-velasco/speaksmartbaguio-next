"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { fetchAPI } from "@/lib/fetch-api";
import { Flex, Heading, Text, Button, Card, Badge, Spinner, Container, Box, TextField } from "@radix-ui/themes";
import { Pagination } from "@/components/Pagination";
import { AudioPlayButton } from "@/components/AudioPlayButton";
import { Search } from "lucide-react";

const ITEMS_PER_PAGE = 12;

interface PhrasebookItem {
  id: string;
  ilokanoWord: string;
  englishTranslation: string;
  tagalogTranslation: string;
  partOfSpeech: string;
  tts_url?: string;
}

export default function PhrasebookPage() {
  const { user, hasPermission } = useAuth();
  const [items, setItems] = useState<PhrasebookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const cursorMap = useRef<Record<number, string | undefined>>({ 1: undefined });

  const fetchPage = useCallback(async (page: number, search: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(ITEMS_PER_PAGE) });
      const cursor = cursorMap.current[page];
      if (cursor) {
        params.set("cursor", cursor);
      }
      if (search) {
        params.set("ilokanoWord", search.replace(/\*/g, "") + "*");
      }

      const result = await fetchAPI(`/api/v1/phrasebook?${params}`);
      setItems(result.data || []);
      setHasMore(result.hasMore || false);

      if (result.nextCursor) {
        cursorMap.current[page + 1] = result.nextCursor;
      }
    } catch (error) {
      console.error("Failed to fetch phrasebook:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cursorMap.current = { 1: undefined };
    setCurrentPage(1);
    fetchPage(1, searchTerm);
  }, [fetchPage, searchTerm]);

  function handlePageChange(page: number) {
    setCurrentPage(page);
    fetchPage(page, searchTerm);
  }

  const totalDiscoveredPages = Math.max(...Object.keys(cursorMap.current).map(Number));
  return (
    <Box minHeight="100vh">
      <Container size="4" px="4" py="6">
        <Flex justify="between" align="start" mb="4">
          <Box>
            <Heading size="7" mb="1" highContrast>Phrasebook</Heading>
            <Text color="gray" size="3">Common Ilokano phrases and expressions</Text>
          </Box>
          {hasPermission("phrasebook:create") && (
            <Button asChild size="2">
              <Link href={`/phrasebook/new${searchTerm ? `?phrase=${encodeURIComponent(searchTerm)}` : ''}`}>
                Add Phrase
              </Link>
            </Button>
          )}
        </Flex>

        <Box mb="5">
          <TextField.Root
            placeholder="Search phrases..."
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
            <Text color="gray">No phrases found</Text>
          </Flex>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => (
                <Link key={item.id} href={`/phrasebook/${item.id}`} style={{ textDecoration: "none" }}>
                  <Card size="2" style={{ cursor: "pointer" }} className="transition-shadow hover:shadow-lg">
                    <Flex align="center" gap="1" mb="2">
                      <Heading size="4" highContrast>{item.ilokanoWord}</Heading>
                      {item.tts_url && <AudioPlayButton src={item.tts_url} size="1" />}
                    </Flex>
                    <Flex direction="column" gap="1">
                      <Text size="2"><Text color="gray">English:</Text> <Text highContrast>{item.englishTranslation}</Text></Text>
                      <Text size="2"><Text color="gray">Tagalog:</Text> <Text highContrast>{item.tagalogTranslation}</Text></Text>
                      <Text size="2">
                        <Text color="gray">Type:</Text>{" "}
                        <Badge color="green" variant="soft" style={{ textTransform: "capitalize" }}>
                          {item.partOfSpeech}
                        </Badge>
                      </Text>
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
