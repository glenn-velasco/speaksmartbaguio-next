import { z } from "zod";

export const dictionaryQuerySchema = z.object({
  ilokanoWord: z.string().min(1, { error: "Ilokano word is required" }),
  englishTranslation: z.string().min(1, { error: "English translation is required" }),
  tagalogTranslation: z.string().min(1, { error: "Tagalog translation is required" }),
  partOfSpeech: z.enum(["noun", "verb", "adjective", "adverb", "pronoun", "phrase", "other"]).or(z.string().min(1)),
  category: z.string().min(1, { error: "Category is required" }),
  tts_url: z.string().min(1, { error: "Text to speech url to to is required" }),
});

export const dictionaryDatabaseSchema = dictionaryQuerySchema.extend({
  id: z.string().min(1, { error: "ID is required." }),
});

export type DictionaryQuery = z.infer<typeof dictionaryQuerySchema>;

export type DictionaryEntry = z.infer<typeof dictionaryDatabaseSchema>;