"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { fetchAPI } from "@/lib/fetch-api";
import { Tabs, Flex, Heading, Text, Button, Card, Badge, Spinner, Container, Box, TextField } from "@radix-ui/themes";
import { Pagination } from "@/components/Pagination";
import { AudioPlayButton } from "@/components/AudioPlayButton";
import { Search } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import { devLog } from "@/lib/dev-log";

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
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<PhrasebookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");

  const { currentPage, goToPage } = usePagination({
    storageKey: "pagination:phrasebook",
  });

  const prevFilterRef = useRef(filter);
  const prevSearchRef = useRef(searchTerm);

  useEffect(() => {
    const filterChanged = prevFilterRef.current !== filter;
    const searchChanged = prevSearchRef.current !== searchTerm;
    prevFilterRef.current = filter;
    prevSearchRef.current = searchTerm;

    if (filterChanged || searchChanged) {
      goToPage(1);
    }
  }, [filter, searchTerm, goToPage]);

  const fetchPage = useCallback(async (page: number, filterVal: string, searchVal: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(ITEMS_PER_PAGE),
        page: String(page),
      });
      if (filterVal !== "all") {
        params.set("partOfSpeech", filterVal);
      }
      if (searchVal) {
        params.set("ilokanoWord", searchVal.replace(/\*/g, "") + "*");
      }

      devLog("Fetching phrasebook with params:", params.toString());
      const result = await fetchAPI(`/api/v1/phrasebook?${params}`);
      devLog("Phrasebook result:", result.data?.length, "items, totalCount:", result.totalCount);
      setItems(result.data || []);
      setHasMore(result.hasMore || false);
      setTotalCount(result.totalCount || 0);
    } catch (error) {
      console.error("Failed to fetch phrasebook:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    devLog("Phrasebook useEffect triggered - filter:", filter, "page:", currentPage, "search:", searchTerm);
    fetchPage(currentPage, filter, searchTerm);
  }, [currentPage, filter, searchTerm, fetchPage]);

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

        <Tabs.Root value={filter} onValueChange={setFilter}>
          <Tabs.List size="2" mb="5">
            {["all", "Noun", "Verb", "Adjective", "Adverb", "Pronoun", "Phrase", "Other"].map((tab) => (
              <Tabs.Trigger key={tab} value={tab} style={{ textTransform: "capitalize" }}>
                {tab}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs.Root>

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
              totalItems={totalCount}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={goToPage}
              loading={loading}
            />
          </>
        )}
      </Container>
    </Box>
  );
}
