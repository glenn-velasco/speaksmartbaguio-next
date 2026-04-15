"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createSubmission } from "@/lib/actions";
import { Select, Button, Card, Heading, Text, Flex, Box, Container, Spinner, Callout, TextField } from "@radix-ui/themes";
import { AlertCircle, Check } from "lucide-react";

function PhrasebookForm() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPhrase = searchParams.get("phrase") || searchParams.get("word");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    ilokanoWord: initialPhrase || "",
    englishTranslation: "",
    tagalogTranslation: "",
    partOfSpeech: "Phrase",
    tts_url: "",
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
    const result = await createSubmission({
      collection: "phrasebook",
      action: "create",
      data: formData,
    }, token);

    setLoading(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        router.push("/phrasebook");
      }, 2000);
    } else {
      setError(result.error);
    }
  }

  if (success) {
    return (
      <Flex minHeight="100vh" align="center" justify="center">
        <Flex direction="column" align="center" gap="3">
          <Check className="w-12 h-12" style={{ color: "var(--green-9)" }} />
          <Heading size="5" highContrast>Submission Created!</Heading>
          <Text color="gray">Your suggestion is pending admin approval.</Text>
        </Flex>
      </Flex>
    );
  }

  return (
    <Box minHeight="100vh">
      <Container size="2" px="4" py="6">
        <Heading size="7" mb="1" highContrast>Add New Phrase</Heading>
        <Text color="gray" size="3" as="p" mb="6">
          Submit a new Ilokano phrase. An admin will review before it&apos;s published.
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
                <Text as="label" htmlFor="ilokanoWord" size="2" weight="medium" mb="1">Ilokano Phrase *</Text>
                <TextField.Root id="ilokanoWord" required value={formData.ilokanoWord} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, ilokanoWord: e.target.value })} size="3" />
              </Box>

              <Box>
                <Text as="label" htmlFor="englishTranslation" size="2" weight="medium" mb="1">English Translation *</Text>
                <TextField.Root id="englishTranslation" required value={formData.englishTranslation} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, englishTranslation: e.target.value })} size="3" />
              </Box>

              <Box>
                <Text as="label" htmlFor="tagalogTranslation" size="2" weight="medium" mb="1">Tagalog Translation *</Text>
                <TextField.Root id="tagalogTranslation" required value={formData.tagalogTranslation} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, tagalogTranslation: e.target.value })} size="3" />
              </Box>

              <Box>
                <Text as="label" size="2" weight="medium" mb="1">Type *</Text>
                <Select.Root value={formData.partOfSpeech} onValueChange={(value) => setFormData({ ...formData, partOfSpeech: value })}>
                  <Select.Trigger style={{ width: "100%" }} />
                  <Select.Content>
                    {["Phrase", "Greeting", "Question", "Expression", "Other"].map((pos) => (
                      <Select.Item key={pos} value={pos}>{pos}</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Box>

              <Box>
                <Text as="label" htmlFor="tts_url" size="2" weight="medium" mb="1">TTS URL (optional)</Text>
                <TextField.Root id="tts_url" type="url" placeholder="https://..." value={formData.tts_url} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, tts_url: e.target.value })} size="3" />
              </Box>

              <Flex gap="3">
                <Button type="submit" disabled={loading} size="3" style={{ flex: 1 }}>
                  {loading ? "Submitting..." : "Submit for Review"}
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

export default function NewPhrasebookPage() {
  return (
    <Suspense fallback={<Flex minHeight="100vh" align="center" justify="center"><Spinner size="3" /></Flex>}>
      <PhrasebookForm />
    </Suspense>
  );
}
