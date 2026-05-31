"use client";

import { Suspense } from "react";
import { Flex, Spinner } from "@radix-ui/themes";
import { BatchCreateForm, FormField } from "@/components/BatchCreateForm";

const phrasebookFields: FormField[] = [
  { name: "ilokanoWord", label: "Ilokano Phrase", type: "text", required: true, unique: true },
  { name: "englishTranslation", label: "English Translation", type: "text", required: true },
  { name: "tagalogTranslation", label: "Tagalog Translation", type: "text", required: true },
  { name: "partOfSpeech", label: "Type", type: "select", required: true, options: ["Phrase", "Greeting", "Question", "Expression", "Other"] },
  { name: "tts_url", label: "TTS Audio", type: "audio" },
];

export default function NewPhrasebookPage() {
  return (
    <Suspense fallback={<Flex minHeight="100vh" align="center" justify="center"><Spinner size="3" /></Flex>}>
      <BatchCreateForm
        collection="phrasebook"
        title="Add New Phrase"
        description={(role) => role === "admin"
          ? "Add new Ilokano phrases. Entries are created immediately."
          : "Submit new Ilokano phrases for review. An admin will approve before they're published."}
        fields={phrasebookFields}
        defaultValues={{
          ilokanoWord: "",
          englishTranslation: "",
          tagalogTranslation: "",
          partOfSpeech: "Phrase",
          tts_url: "",
        }}
        successRedirect="/phrasebook"
        searchParamMapping={{ "phrase": "ilokanoWord", "word": "ilokanoWord" }}
      />
    </Suspense>
  );
}
