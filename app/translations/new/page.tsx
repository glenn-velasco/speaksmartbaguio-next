"use client";

import { Suspense } from "react";
import { Flex, Spinner } from "@radix-ui/themes";
import { BatchCreateForm, FormField } from "@/components/BatchCreateForm";

const translationFields: FormField[] = [
  { name: "english", label: "English", type: "text", required: true },
  { name: "ilokano", label: "Ilokano", type: "text", required: true, unique: true },
  { name: "tagalog", label: "Tagalog", type: "text", required: true },
];

export default function NewTranslationPage() {
  return (
    <Suspense fallback={<Flex minHeight="100vh" align="center" justify="center"><Spinner size="3" /></Flex>}>
      <BatchCreateForm
        collection="translations"
        title="Add New Translation"
        description={(role) => role === "admin"
          ? "Add new translations. Entries are created immediately."
          : "Submit new translations for review. An admin will approve before they're published."}
        fields={translationFields}
        defaultValues={{
          english: "",
          ilokano: "",
          tagalog: "",
        }}
        successRedirect="/translations"
        searchParamMapping={{ "translation": "english", "word": "english" }}
      />
    </Suspense>
  );
}
