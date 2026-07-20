import { adminDb } from "@/lib/firebase-admin";
import { generateSearchFields } from "@/lib/search-utils";

const COLLECTIONS = [
  {
    name: "dictionary",
    searchableFields: ["ilokanoWord", "englishTranslation", "tagalogTranslation"],
  },
  {
    name: "translations",
    searchableFields: ["ilokano", "english", "tagalog"],
  },
  {
    name: "phrasebook",
    searchableFields: ["ilokanoWord", "englishTranslation", "tagalogTranslation"],
  },
  {
    name: "submissions",
    searchableFields: ["ilokanoWord", "englishTranslation", "tagalogTranslation"],
  },
];

async function backfillCollection(name: string, searchableFields: string[]) {
  const snapshot = await adminDb.collection(name).get();
  let updated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const existingSearch = data._search || {};

    const newSearch = generateSearchFields(data, searchableFields);

    if (existingSearch.all !== newSearch.all) {
      await doc.ref.update({ _search: { ...existingSearch, all: newSearch.all } });
      updated++;
    }
  }

  console.log(`${name}: ${updated}/${snapshot.size} documents updated`);
}

async function main() {
  for (const { name, searchableFields } of COLLECTIONS) {
    await backfillCollection(name, searchableFields);
  }
  console.log("Done.");
}

main().catch(console.error);
