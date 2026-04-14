import { z } from "zod";

export const dictionaryQuerySchema = z.object({
  ilokanoWord: z.string().min(1, { message: "Ilokano word is required" }),
  englishTranslation: z.string().min(1, { message: "English translation is required" }),
  tagalogTranslation: z.string().min(1, { message: "Tagalog translation is required" }),
  partOfSpeech: z.enum(["noun", "verb", "adjective", "adverb", "pronoun", "phrase", "other"]).or(z.string().min(1)),
  category: z.string().min(1, { message: "Category is required" }),
  tts_url: z.string().min(1, { message: "Text to speech url is required" }),
});

export const dictionaryDatabaseSchema = dictionaryQuerySchema.extend({
  id: z.string().min(1, { message: "ID is required." }),
});

export type DictionaryQuery = z.infer<typeof dictionaryQuerySchema>;

export type DictionaryEntry = z.infer<typeof dictionaryDatabaseSchema>;