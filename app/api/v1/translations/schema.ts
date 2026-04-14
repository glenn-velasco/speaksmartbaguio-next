import { z } from "zod";

export const translationsQuerySchema = z.object({
  english: z.string().min(1, { message: "English is required" }),
  ilokano: z.string().min(1, { message: "Ilokano is required" }),
  tagalog: z.string().min(1, { message: "Tagalog is required" }),
});

export const translationsDatabaseSchema = translationsQuerySchema.extend({
    id: z.string().min(1, { message: "ID is required" }),
});

export type TranslationDatabase = z.infer<typeof translationsDatabaseSchema>;

export type TranslationQuery = z.infer<typeof translationsQuerySchema>;