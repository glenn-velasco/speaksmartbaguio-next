"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createSubmission, getItemById } from "@/lib/actions";
import { AlertDialog, Button, Card, Heading, Text, Badge, Flex, Box, Container, Spinner, DataList, Callout } from "@radix-ui/themes";
import { Check, AlertCircle } from "lucide-react";

interface TranslationItem {
  english: string;
  ilokano: string;
  tagalog: string;
}

export default function TranslationDetailPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [item, setItem] = useState<TranslationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchItem() {
      try {
        const found = await getItemById("translations", id);
        setItem(found as unknown as TranslationItem || null);
      } catch (error) {
        console.error("Failed to fetch translation:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchItem();
  }, [id]);

  async function handleDelete() {
    if (!user || !item) return;

    setActionLoading(true);
    setError("");
    const token = await user.getIdToken();
    const result = await createSubmission({
      collection: "translations",
      action: "delete",
      targetId: id,
      data: { ...item },
      reason: "User requested deletion",
    }, token);
    setActionLoading(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        router.push("/translations");
      }, 2000);
    } else {
      setError(result.error || "Failed to submit deletion request");
    }
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
          <Heading size="5" highContrast>Translation Not Found</Heading>
          <Button asChild variant="ghost">
            <Link href="/translations">← Back to Translations</Link>
          </Button>
        </Flex>
      </Flex>
    );
  }

  if (success) {
    return (
      <Flex minHeight="100vh" align="center" justify="center">
        <Flex direction="column" align="center" gap="3">
          <Check className="w-12 h-12" style={{ color: "var(--green-9)" }} />
          <Heading size="5" highContrast>Deletion Request Submitted</Heading>
          <Text color="gray">An admin will review before the item is removed.</Text>
        </Flex>
      </Flex>
    );
  }

  return (
    <Box minHeight="100vh">
      <Container size="3" px="4" py="6">
        <Box mb="4">
          <Button asChild variant="ghost" size="2">
            <Link href="/translations">← Back to Translations</Link>
          </Button>
        </Box>

        {error && (
          <Callout.Root color="red" size="2" mb="4">
            <Callout.Icon><AlertCircle className="w-4 h-4" /></Callout.Icon>
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        )}

        <Card size="4">
          <Flex justify="between" align="start" mb="5">
            <Box>
              <Heading size="8" mb="2" highContrast>{item.english}</Heading>
              <Badge color="purple" variant="soft" size="2">Translation</Badge>
            </Box>

            {user && (
              <Flex gap="2">
                {hasPermission("translations:edit") && (
                  <Button asChild variant="soft" color="orange">
                    <Link href={`/translations/${id}/edit`}>Edit</Link>
                  </Button>
                )}

                {hasPermission("translations:delete") && (
                  <AlertDialog.Root>
                    <AlertDialog.Trigger>
                      <Button variant="soft" color="red">Delete</Button>
                    </AlertDialog.Trigger>

                    <AlertDialog.Content maxWidth="450px">
                      <AlertDialog.Title>Delete this translation?</AlertDialog.Title>
                      <AlertDialog.Description size="2">
                        This will submit a deletion request for &quot;{item.english}&quot;. An admin will review before it&apos;s removed.
                      </AlertDialog.Description>
                      <Flex gap="3" mt="4" justify="end">
                        <AlertDialog.Cancel>
                          <Button variant="soft" color="gray">Cancel</Button>
                        </AlertDialog.Cancel>
                        <AlertDialog.Action>
                          <Button color="red" onClick={handleDelete} disabled={actionLoading}>
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
              <DataList.Label>Ilokano</DataList.Label>
              <DataList.Value>
                <Text color="indigo" weight="medium">{item.ilokano}</Text>
              </DataList.Value>
            </DataList.Item>
            <DataList.Item>
              <DataList.Label>Tagalog</DataList.Label>
              <DataList.Value>
                <Text color="green" weight="medium">{item.tagalog}</Text>
              </DataList.Value>
            </DataList.Item>
          </DataList.Root>
        </Card>
      </Container>
    </Box>
  );
}
