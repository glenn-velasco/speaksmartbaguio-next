import { createCRUDHandler } from "@/lib/api-handler";
import { translationsQuerySchema, translationsDatabaseSchema } from "@/app/api/v1/translations/schema";

export const { GET, POST, PUT, DELETE } = createCRUDHandler({
  collection: "translations",
  createSchema: translationsQuerySchema,
  updateSchema: translationsDatabaseSchema,
  uniqueField: "ilokano",
  filterableFields: ["english", "ilokano", "tagalog"],
  searchableFields: ["ilokano", "english", "tagalog"],
});