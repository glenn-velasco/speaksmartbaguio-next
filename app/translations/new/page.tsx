"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createSubmission, createAndAutoApproveSubmission } from "@/lib/actions";
import { Button, Card, Heading, Text, Flex, Box, Container, Spinner, Callout, TextField } from "@radix-ui/themes";
import { AlertCircle, Check } from "lucide-react";

function TranslationForm() {
  const { user, role } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTranslation = searchParams.get("translation") || searchParams.get("word");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isDirectEdit, setIsDirectEdit] = useState(false);

  const [formData, setFormData] = useState({
    english: initialTranslation || "",
    ilokano: "",
    tagalog: "",
  });

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
        action: "create",
        data: formData,
      }, token);
      if (result.success) {
        setIsDirectEdit(true);
      }
    } else {
      result = await createSubmission({
        collection: "translations",
        action: "create",
        data: formData,
      }, token);
    }

    setLoading(false);

    if (result.success) {
      setSuccess(true);
      
      const newItemId = result.itemId;
      if (role === "admin" && newItemId) {
        router.push(`/translations/${newItemId}`);
      } else {
        setTimeout(() => {
          router.push("/translations");
        }, 2000);
      }
    } else {
      setError(result.error || "An error occurred");
    }
  }

  if (success) {
    if (!isDirectEdit) {
      return (
        <Flex minHeight="100vh" align="center" justify="center">
          <Flex direction="column" align="center" gap="3">
            <Check className="w-12 h-12" style={{ color: "var(--green-9)" }} />
            <Heading size="5" highContrast>
              Submission Created!
            </Heading>
            <Text color="gray">
              Your suggestion is pending admin approval.
            </Text>
          </Flex>
        </Flex>
      );
    }
    return null;
  }

  return (
    <Box minHeight="100vh">
      <Container size="2" px="4" py="6">
        <Heading size="7" mb="1" highContrast>Add New Translation</Heading>
        <Text color="gray" size="3" as="p" mb="6">
          {role === "admin"
            ? "Add a new translation. Changes are applied immediately."
            : "Submit a new Translation. An admin will review before it&apos;s published."}
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
                  {loading ? (role === "admin" ? "Saving..." : "Submitting...") : (role === "admin" ? "Add Translation" : "Submit for Review")}
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

export default function NewTranslationPage() {
  return (
    <Suspense fallback={<Flex minHeight="100vh" align="center" justify="center"><Spinner size="3" /></Flex>}>
      <TranslationForm />
    </Suspense>
  );
}
