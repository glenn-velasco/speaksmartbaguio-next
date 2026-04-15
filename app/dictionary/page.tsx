"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import * as Tabs from "@radix-ui/react-tabs";
import { fetchAPI } from "@/lib/fetch-api";

interface DictionaryItem {
  id: string;
  ilokanoWord: string;
  englishTranslation: string;
  tagalogTranslation: string;
  partOfSpeech: string;
  category?: string;
  tts_url?: string;
}

export default function DictionaryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<DictionaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    async function fetchDictionary() {
      try {
        const params = new URLSearchParams({ limit: "100" });
        if (filter !== "all") {
          params.set("partOfSpeech", filter);
        }

        const result = await fetchAPI(`/api/v1/dictionary?${params}`);
        setItems(result.data || []);
      } catch (error) {
        console.error("Failed to fetch dictionary:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDictionary();
  }, [filter]);

  const filteredItems = items.filter(item =>
    item.ilokanoWord.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.englishTranslation.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.tagalogTranslation.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Dictionary
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Browse and search Ilokano words and translations
              </p>
            </div>
            {user && (
              <Link
                href={`/dictionary/new${searchTerm ? `?word=${encodeURIComponent(searchTerm)}` : ''}`}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
              >
                Add Word
              </Link>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <input
              type="text"
              placeholder="Search words..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <Tabs.Root value={filter} onValueChange={setFilter}>
            <Tabs.List className="flex gap-2 mb-6 overflow-x-auto">
              {["all", "Noun", "Verb", "Adjective", "Adverb", "Pronoun", "Phrase", "Other"].map((tab) => (
                <Tabs.Trigger
                  key={tab}
                  value={tab}
                  className="px-4 py-2 text-sm font-medium rounded-md capitalize transition-colors data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:bg-white dark:bg-gray-900 data-[state=inactive]:text-gray-700 dark:text-gray-300 data-[state=inactive]:border data-[state=inactive]:border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {tab}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs.Root>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">No words found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
              <Link
                key={item.id}
                href={`/dictionary/${item.id}`}
                className="block p-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {item.ilokanoWord}
                  </h3>
                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded capitalize">
                    {item.partOfSpeech}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">English:</span>{" "}
                    <span className="text-gray-900 dark:text-white">{item.englishTranslation}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Tagalog:</span>{" "}
                    <span className="text-gray-900 dark:text-white">{item.tagalogTranslation}</span>
                  </div>
                  {item.category && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Category:</span>{" "}
                      <span className="text-gray-900 dark:text-white">{item.category}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
