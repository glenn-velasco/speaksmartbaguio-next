import { createCRUDHandler } from "@/lib/api-handler";
import { phraseBookQuerySchema, phraseBookDatabaseSchema } from "@/app/api/v1/phrasebook/schema";

export const { GET, POST, PUT, DELETE } = createCRUDHandler({
  collection: "phrasebook",
  createSchema: phraseBookQuerySchema,
  updateSchema: phraseBookDatabaseSchema,
  uniqueField: "ilokanoWord",
  filterableFields: ["partOfSpeech", "englishTranslation", "ilokanoWord", "tagalogTranslation", "tts_url"],
});