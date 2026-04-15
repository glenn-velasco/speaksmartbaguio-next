"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { fetchAPI } from "@/lib/fetch-api";

interface TranslationItem {
  id: string;
  english: string;
  ilokano: string;
  tagalog: string;
}

export default function TranslationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<TranslationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchTranslations() {
      try {
        const result = await fetchAPI("/api/v1/translations?limit=100");
        setItems(result.data || []);
      } catch (error) {
        console.error("Failed to fetch translations:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchTranslations();
  }, []);

  const filteredItems = items.filter(item =>
    item.english.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.ilokano.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.tagalog.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Translations
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Direct word translations between languages
              </p>
            </div>
            {user && (
              <Link
                href={`/translations/new${searchTerm ? `?translation=${encodeURIComponent(searchTerm)}` : ''}`}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
              >
                Add Translation
              </Link>
            )}
          </div>

          <input
            type="text"
            placeholder="Search translations..."
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
            <p className="text-gray-600 dark:text-gray-400">No translations found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
              <Link
                key={item.id}
                href={`/translations/${item.id}`}
                className="block p-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-shadow"
              >
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">English</span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">{item.english}</span>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Ilokano</span>
                    <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">{item.ilokano}</span>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Tagalog</span>
                    <span className="text-lg font-semibold text-green-600 dark:text-green-400">{item.tagalog}</span>
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
