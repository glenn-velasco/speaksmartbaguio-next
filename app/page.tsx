import type { Metadata } from "next";
import Link from "next/link";
import { Book, MessageCircle, Globe } from "lucide-react";

export const metadata: Metadata = {
  title: "Speak Smart Baguio - Ilokano Dictionary & Translations",
  description: "Collaborative Ilokano language dictionary and translation platform",
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4">
            Speak Smart Baguio
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8">
            A collaborative platform for learning and preserving the Ilokano language
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/dictionary"
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-lg"
            >
              Browse Dictionary
            </Link>
            <Link
              href="/phrasebook"
              className="px-8 py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium rounded-lg border-2 border-gray-300 dark:border-gray-700 transition-colors text-lg"
            >
              Explore Phrasebook
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 border border-gray-200 dark:border-gray-800">
            <div className="mb-4"><Book className="w-10 h-10 text-blue-500" /></div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Dictionary</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Browse and contribute to our growing collection of Ilokano words with English and Tagalog translations.
            </p>
            <Link href="/dictionary" className="text-blue-600 hover:text-blue-500 font-medium">
              Explore →
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 border border-gray-200 dark:border-gray-800">
            <div className="mb-4"><MessageCircle className="w-10 h-10 text-green-500" /></div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Phrasebook</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Learn common Ilokano phrases and expressions for everyday conversations.
            </p>
            <Link href="/phrasebook" className="text-blue-600 hover:text-blue-500 font-medium">
              Explore →
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 border border-gray-200 dark:border-gray-800">
            <div className="mb-4"><Globe className="w-10 h-10 text-purple-500" /></div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Translations</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Direct word translations between English, Ilokano, and Tagalog languages.
            </p>
            <Link href="/translations" className="text-blue-600 hover:text-blue-500 font-medium">
              Explore →
            </Link>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 border border-gray-200 dark:border-gray-800">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 text-center">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">1</span>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Sign Up</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Create an account to start contributing</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">2</span>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Contribute</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Add, edit, or suggest new words and phrases</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">3</span>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Review</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Admins review all submissions for quality</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">4</span>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Publish</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Approved content goes live for everyone</p>
            </div>
          </div>
        </div>

        <footer className="mt-16 text-center text-gray-500 dark:text-gray-400 text-sm">
          <p>Speak Smart Baguio © 2026 | Preserving the Ilokano Language Together</p>
        </footer>
      </div>
    </main>
  );
}
