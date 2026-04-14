import { createCRUDHandler } from "@/lib/api-handler";
import { dictionaryQuerySchema, dictionaryDatabaseSchema } from "@/app/api/v1/dictionary/schema";

export const { GET, POST, PUT, DELETE } = createCRUDHandler({
  collection: "dictionary",
  createSchema: dictionaryQuerySchema,
  updateSchema: dictionaryDatabaseSchema,
  uniqueField: "ilokanoWord",
  filterableFields: ["partOfSpeech", "category", "englishTranslation", "ilokanoWord", "tagalogTranslation", "tts_url"],
});