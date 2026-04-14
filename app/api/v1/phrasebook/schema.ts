import { z } from "zod";

export const phraseBookQuerySchema = z.object({
  ilokanoWord: z.string().min(1, { error: "Ilokano word is required" }),
  englishTranslation: z.string().min(1, { error: "English translation is required" }),
  tagalogTranslation: z.string().min(1, { error: "Tagalog translation is required" }),
  partOfSpeech: z.enum(["noun", "verb", "adjective", "adverb", "pronoun", "phrase", "other"]).or(z.string().min(1)),
  tts_url: z.string().min(1, { error: "Text to speech url to to is required" }),
});

export const phraseBookDatabaseSchema = phraseBookQuerySchema.extend({
  id: z.string().min(1, { error: "ID is required." }),
});

export type PhraseBookItem = z.infer<typeof phraseBookDatabaseSchema>;

export type PhraseBookQuery = z.infer<typeof phraseBookQuerySchema>;