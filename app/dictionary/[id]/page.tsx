"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createSubmission } from "@/lib/actions";
import { fetchAPI } from "@/lib/fetch-api";
import { AlertDialog, Button, Card, Heading, Text, Badge, Flex, Box, Container, Spinner, DataList } from "@radix-ui/themes";
import { AudioPlayButton } from "@/components/AudioPlayButton";

export default function DictionaryDetailPage() {
  const { user, role } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function fetchItem() {
      try {
        const result = await fetchAPI(`/api/v1/dictionary?limit=100`);
        const found = result.data.find((i: any) => i.id === id);
        setItem(found || null);
      } catch (error) {
        console.error("Failed to fetch item:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchItem();
  }, [id]);

  async function handleDelete() {
    if (!user) return;

    setActionLoading(true);
    const token = await user.getIdToken();
    await createSubmission({
      collection: "dictionary",
      action: "delete",
      targetId: id,
      data: {},
      reason: "User requested deletion",
    }, token);
    setActionLoading(false);
    router.push("/dictionary");
  }

  if (loading) {
    return (
      <Flex minHeight="100vh" align="center" justify="center">
        <Spinner size="3" />
      </Flex>
    );
  }

  if (!item) {
    return (
      <Flex minHeight="100vh" align="center" justify="center">
        <Flex direction="column" align="center" gap="3">
          <Heading size="5" highContrast>Word Not Found</Heading>
          <Button asChild variant="ghost">
            <Link href="/dictionary">← Back to Dictionary</Link>
          </Button>
        </Flex>
      </Flex>
    );
  }

  return (
    <Box minHeight="100vh">
      <Container size="3" px="4" py="6">
        <Box mb="4">
          <Button asChild variant="ghost" size="2">
            <Link href="/dictionary">← Back to Dictionary</Link>
          </Button>
        </Box>

        <Card size="4">
          <Flex justify="between" align="start" mb="5">
            <Box>
              <Flex align="center" gap="2" mb="2">
                <Heading size="8" highContrast>{item.ilokanoWord}</Heading>
                {item.tts_url && <AudioPlayButton src={item.tts_url} size="3" label="Listen to pronunciation" />}
              </Flex>
              <Badge color="indigo" variant="soft" size="2" style={{ textTransform: "capitalize" }}>
                {item.partOfSpeech}
              </Badge>
            </Box>

            {user && (
              <Flex gap="2">
                {(role === 'admin' || role === 'editor') && (
                  <Button asChild variant="soft" color="orange">
                    <Link href={`/dictionary/${id}/edit`}>Edit</Link>
                  </Button>
                )}

                {role === 'admin' && (
                  <AlertDialog.Root>
                    <AlertDialog.Trigger>
                      <Button variant="soft" color="red">Delete</Button>
                    </AlertDialog.Trigger>
                    <AlertDialog.Content maxWidth="450px">
                      <AlertDialog.Title>Delete this word?</AlertDialog.Title>
                      <AlertDialog.Description size="2">
                        This will submit a deletion request for &quot;{item.ilokanoWord}&quot;. An admin will review before it&apos;s removed.
                      </AlertDialog.Description>
                      <Flex gap="3" mt="4" justify="end">
                        <AlertDialog.Cancel>
                          <Button variant="soft" color="gray">Cancel</Button>
                        </AlertDialog.Cancel>
                        <AlertDialog.Action>
                          <Button
                            color="red"
                            onClick={handleDelete}
                            disabled={actionLoading}
                          >
                            {actionLoading ? "Submitting..." : "Submit Deletion"}
                          </Button>
                        </AlertDialog.Action>
                      </Flex>
                    </AlertDialog.Content>
                  </AlertDialog.Root>
                )}
              </Flex>
            )}
          </Flex>

          <DataList.Root size="3">
            <DataList.Item>
              <DataList.Label>English Translation</DataList.Label>
              <DataList.Value>{item.englishTranslation}</DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Tagalog Translation</DataList.Label>
              <DataList.Value>{item.tagalogTranslation}</DataList.Value>
            </DataList.Item>
            {item.category && (
              <DataList.Item>
                <DataList.Label>Category</DataList.Label>
                <DataList.Value>{item.category}</DataList.Value>
              </DataList.Item>
            )}
          </DataList.Root>
        </Card>
      </Container>
    </Box>
  );
}
