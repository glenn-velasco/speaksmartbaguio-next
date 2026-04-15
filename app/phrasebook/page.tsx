"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { fetchAPI } from "@/lib/fetch-api";

interface PhrasebookItem {
  id: string;
  ilokanoWord: string;
  englishTranslation: string;
  tagalogTranslation: string;
  partOfSpeech: string;
  tts_url?: string;
}

export default function PhrasebookPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<PhrasebookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchPhrasebook() {
      try {
        const result = await fetchAPI("/api/v1/phrasebook?limit=100");
        setItems(result.data || []);
      } catch (error) {
        console.error("Failed to fetch phrasebook:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPhrasebook();
  }, []);

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
                Phrasebook
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Common Ilokano phrases and expressions
              </p>
            </div>
            {user && (
              <Link
                href={`/phrasebook/new${searchTerm ? `?phrase=${encodeURIComponent(searchTerm)}` : ''}`}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
              >
                Add Phrase
              </Link>
            )}
          </div>

          <input
            type="text"
            placeholder="Search phrases..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">No phrases found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
              <Link
                key={item.id}
                href={`/phrasebook/${item.id}`}
                className="block p-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-shadow"
              >
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                  {item.ilokanoWord}
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">English:</span>{" "}
                    <span className="text-gray-900 dark:text-white">{item.englishTranslation}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Tagalog:</span>{" "}
                    <span className="text-gray-900 dark:text-white">{item.tagalogTranslation}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Type:</span>{" "}
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded capitalize">
                      {item.partOfSpeech}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
