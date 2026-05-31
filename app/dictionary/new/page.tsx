"use client";

import { Suspense } from "react";
import { Flex, Spinner } from "@radix-ui/themes";
import { BatchCreateForm, FormField } from "@/components/BatchCreateForm";

const dictionaryFields: FormField[] = [
  { name: "ilokanoWord", label: "Ilokano Word", type: "text", required: true, unique: true },
  { name: "englishTranslation", label: "English Translation", type: "text", required: true },
  { name: "tagalogTranslation", label: "Tagalog Translation", type: "text", required: true },
  { name: "partOfSpeech", label: "Part of Speech", type: "select", required: true, options: ["Noun", "Verb", "Adjective", "Adverb", "Pronoun", "Phrase", "Other"] },
  { name: "category", label: "Category", type: "text" },
  { name: "tts_url", label: "TTS Audio", type: "audio" },
];

export default function NewDictionaryPage() {
  return (
    <Suspense fallback={<Flex minHeight="100vh" align="center" justify="center"><Spinner size="3" /></Flex>}>
      <BatchCreateForm
        collection="dictionary"
        title="Add New Word"
        description={(role) => role === "admin"
          ? "Add new Ilokano words. Entries are created immediately."
          : "Submit new Ilokano words for review. An admin will approve before they're published."}
        fields={dictionaryFields}
        defaultValues={{
          ilokanoWord: "",
          englishTranslation: "",
          tagalogTranslation: "",
          partOfSpeech: "Noun",
          category: "",
          tts_url: "",
        }}
        successRedirect="/dictionary"
        searchParamMapping={{ "word": "ilokanoWord" }}
      />
    </Suspense>
  );
}
