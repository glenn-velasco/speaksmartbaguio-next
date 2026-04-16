"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createSubmission, createAndAutoApproveSubmission } from "@/lib/actions";
import { Select, Button, Card, Heading, Text, Flex, Box, Container, Spinner, Callout, TextField } from "@radix-ui/themes";
import { AlertCircle, Check } from "lucide-react";
import { AudioUploadInput } from "@/components/AudioUploadInput";
import { AudioPreview } from "@/components/AudioPreview";

function DictionaryForm() {
  const { user, role } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialWord = searchParams.get("word");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isDirectEdit, setIsDirectEdit] = useState(false);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState("");

  const [formData, setFormData] = useState({
    ilokanoWord: initialWord || "",
    englishTranslation: "",
    tagalogTranslation: "",
    partOfSpeech: "Noun",
    category: "",
    tts_url: "",
  });

  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  const handleUploadComplete = (audioUrl: string) => {
    setUploadedAudioUrl(audioUrl);
    setFormData({ ...formData, tts_url: audioUrl });
  };

  const handleUploadError = (errorMsg: string) => {
    setError(errorMsg);
  };

  const handleRemoveAudio = () => {
    setFormData({ ...formData, tts_url: "" });
    setUploadedAudioUrl("");
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");

    const token = await user.getIdToken();

    let result;
    if (role === "admin") {
      result = await createAndAutoApproveSubmission({
        collection: "dictionary",
        action: "create",
        data: formData,
      }, token);
      if (result.success) {
        setIsDirectEdit(true);
      }
    } else {
      result = await createSubmission({
        collection: "dictionary",
        action: "create",
        data: formData,
      }, token);
    }

    setLoading(false);

    if (result.success) {
      setSuccess(true);
      const newItemId = result.itemId;
      if (role === "admin" && newItemId) {
        router.push(`/dictionary/${newItemId}`);
      } else {

        setTimeout(() => {
          router.push("/dictionary");
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
        <Heading size="7" mb="1" highContrast>Add New Word</Heading>
        <Text color="gray" size="3" as="p" mb="6">
          {role === "admin"
            ? "Add a new Ilokano word. Changes are applied immediately."
            : "Submit a new Ilokano word. An admin will review before it&apos;s published."}
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
                <Text as="label" htmlFor="ilokanoWord" size="2" weight="medium" mb="1">Ilokano Word *</Text>
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
                <Text as="label" size="2" weight="medium" mb="1">Part of Speech *</Text>
                <Select.Root value={formData.partOfSpeech} onValueChange={(value) => setFormData({ ...formData, partOfSpeech: value })}>
                  <Select.Trigger style={{ width: "100%" }} />
                  <Select.Content>
                    {["Noun", "Verb", "Adjective", "Adverb", "Pronoun", "Phrase", "Other"].map((pos) => (
                      <Select.Item key={pos} value={pos}>{pos}</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Box>

              <Box>
                <Text as="label" htmlFor="category" size="2" weight="medium" mb="1">Category (optional)</Text>
                <TextField.Root id="category" value={formData.category} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, category: e.target.value })} size="3" />
              </Box>

              <Box>
                <Text size="2" weight="medium" mb="2">TTS Audio (optional)</Text>
                <Flex direction="column" gap="3">
                  {formData.tts_url ? (
                    <>
                      <AudioPreview
                        audioUrl={formData.tts_url}
                        label="Uploaded Audio"
                        onRemove={handleRemoveAudio}
                      />
                    </>
                  ) : (
                    <AudioUploadInput
                      collection="dictionary"
                      itemId="new"
                      onUploadComplete={handleUploadComplete}
                      onUploadError={handleUploadError}
                    />
                  )}
                  <Text size="1" color="gray">
                    Upload an audio file (MP3, WAV, OGG, M4A, FLAC) for pronunciation
                  </Text>
                </Flex>
              </Box>

                <Flex gap="3">
                  <Button type="submit" disabled={loading} size="3" style={{ flex: 1 }}>
                    {loading ? (role === "admin" ? "Saving..." : "Submitting...") : (role === "admin" ? "Add Word" : "Submit for Review")}
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

export default function NewDictionaryPage() {
  return (
    <Suspense fallback={<Flex minHeight="100vh" align="center" justify="center"><Spinner size="3" /></Flex>}>
      <DictionaryForm />
    </Suspense>
  );
}
