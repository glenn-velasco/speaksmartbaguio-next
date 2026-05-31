"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createSubmission, createAndAutoApproveSubmission, getDocumentById } from "@/lib/actions";
import { Button, Card, Heading, Text, Flex, Box, Container, Spinner, Callout, TextField } from "@radix-ui/themes";
import { AlertCircle, Check } from "lucide-react";

export default function EditTranslationPage() {
  const { user, role } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isDirectEdit, setIsDirectEdit] = useState(false);

  const [formData, setFormData] = useState({
    english: "",
    ilokano: "",
    tagalog: "",
  });

  useEffect(() => {
    async function fetchItem() {
      try {
        const item = await getDocumentById("translations", id);

        if (item) {
          const d = item as Record<string, unknown>;
          setFormData({
            english: (d.english as string) || "",
            ilokano: (d.ilokano as string) || "",
            tagalog: (d.tagalog as string) || "",
          });
        }
      } catch (error) {
        console.error("Failed to fetch item:", error);
      } finally {
        setFetching(false);
      }
    }

    fetchItem();
  }, [id]);

  if (!user) {
    router.push("/login");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");

    const token = await user.getIdToken();

    let result;
    if (role === "admin") {
      result = await createAndAutoApproveSubmission({
        collection: "translations",
        action: "update",
        targetId: id,
        data: formData,
      }, token);
      if (result.success) {
        setIsDirectEdit(true);
      }
    } else {
      result = await createSubmission({
        collection: "translations",
        action: "update",
        targetId: id,
        data: formData,
      }, token);
    }

    setLoading(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        router.push("/translations");
      }, 2000);
    } else {
      setError(result.error || "An error occurred");
    }
  }

  if (fetching) {
    return (
      <Flex minHeight="100vh" align="center" justify="center">
        <Spinner size="3" />
      </Flex>
    );
  }

  if (success) {
    return (
      <Flex minHeight="100vh" align="center" justify="center">
        <Flex direction="column" align="center" gap="3">
          <Check className="w-12 h-12" style={{ color: "var(--green-9)" }} />
          <Heading size="5" highContrast>
            {isDirectEdit ? "Changes Saved!" : "Edit Submitted!"}
          </Heading>
          <Text color="gray">
            {isDirectEdit ? "Your changes have been applied directly." : "Your changes are pending admin approval."}
          </Text>
        </Flex>
      </Flex>
    );
  }

  return (
    <Box minHeight="100vh">
      <Container size="2" px="4" py="6">
        <Heading size="7" mb="1" highContrast>Edit Translation</Heading>
        <Text color="gray" size="3" as="p" mb="6">
          {role === "admin"
            ? "Make changes to this translation. Changes are applied immediately."
            : "Suggest changes to this translation. An admin will review before changes are published."}
        </Text>

        {error && (
          <Callout.Root color="red" size="2" mb="4">
            <Callout.Icon><AlertCircle className="w-4 h-4" /></Callout.Icon>
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        )}

        <Card size="3">
          <form onSubmit={handleSubmit}>
            <Flex direction="column" gap="4">
              <Box>
                <Text as="label" htmlFor="english" size="2" weight="medium" mb="1">English *</Text>
                <TextField.Root id="english" required value={formData.english} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, english: e.target.value })} size="3" />
              </Box>

              <Box>
                <Text as="label" htmlFor="ilokano" size="2" weight="medium" mb="1">Ilokano *</Text>
                <TextField.Root id="ilokano" required value={formData.ilokano} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, ilokano: e.target.value })} size="3" />
              </Box>

              <Box>
                <Text as="label" htmlFor="tagalog" size="2" weight="medium" mb="1">Tagalog *</Text>
                <TextField.Root id="tagalog" required value={formData.tagalog} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, tagalog: e.target.value })} size="3" />
              </Box>

              <Flex gap="3">
                <Button type="submit" disabled={loading} size="3" style={{ flex: 1 }}>
                  {loading ? (role === "admin" ? "Saving..." : "Submitting...") : (role === "admin" ? "Save Changes" : "Submit Changes")}
                </Button>
                <Button type="button" variant="soft" color="gray" size="3" onClick={() => router.back()}>
                  Cancel
                </Button>
              </Flex>
            </Flex>
          </form>
        </Card>
      </Container>
    </Box>
  );
}
