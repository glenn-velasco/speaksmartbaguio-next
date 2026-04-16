/**
 * Utility for generating normalized search fields for Firestore.
 */

export function generateSearchFields(data: Record<string, unknown>, searchableFields: string[]) {
  const searchFields: Record<string, string> = {};
  
  for (const field of searchableFields) {
    if (data[field] && typeof data[field] === "string") {
      searchFields[field] = data[field].toLowerCase();
    }
  }
  
  return searchFields;
}
