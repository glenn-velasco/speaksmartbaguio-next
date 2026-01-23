import type { Metadata } from "next";
import EndpointCard from '@/components/EndPointCard';

export const metadata: Metadata = {
  title: "Speak Smart Baguio API",
};

const sections = [
  {
    title: "Dictionary Endpoints",
    items: [
      {
        method: "GET",
        path: "/api/v1/dictionary",
        description: "Fetch all dictionary items (Limit 20 by default).",
        params: ["limit", "partOfSpeech", "category", "englishTranslation", "ilokanoWord", "tagalogTranslation"]
      },
      {
        method: "GET",
        path: "/api/v1/dictionary?category=food",
        description: "Filter dictionary items by category (e.g., food).",
        params: ["category"]
      },
      {
        method: "GET",
        path: "/api/v1/dictionary?limit=5",
        description: "Test the dictionary limit functionality.",
        params: ["limit"]
      }
    ]
  },
  {
    title: "Phrasebook Endpoints",
    items: [
      {
        method: "GET",
        path: "/api/v1/phrasebook",
        description: "Fetch all phrasebook items (Limit 20 by default).",
        params: ["limit", "partOfSpeech", "category", "englishTranslation", "ilokanoWord", "tagalogTranslation"]
      },
      {
        method: "GET",
        path: "/api/v1/phrasebook?category=greetings",
        description: "Filter phrases by category (e.g., greetings).",
        params: ["category"]
      },
      {
        method: "GET",
        path: "/api/v1/phrasebook?ilokanoWord=naimbag",
        description: "Search for a specific Ilokano phrase.",
        params: ["ilokanoWord"]
      }
    ]
  }
];

export default function ApiDashboard() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-black p-4 md:p-8 font-sans transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        
        <header className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">SpeakSmart API v1</h1>
          </div>
        </header>

        <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 p-4 mb-8">
          <p className="text-amber-800 dark:text-amber-200 text-sm">
            <strong>Auth Required:</strong> All requests must include the 
            <code className="bg-amber-100 dark:bg-amber-800 px-1 mx-1 rounded text-amber-900 dark:text-amber-100">x-api-key</code> header.
          </p>
        </div>

        {/* 2. Map through the sections to create grouped grids */}
        <div className="space-y-12">
          {sections.map((section, sIndex) => (
            <section key={sIndex}>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-800 pb-2">
                {section.title}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.items.map((ep, index) => (
                  <EndpointCard key={index} {...ep} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-12 text-center text-gray-400 dark:text-gray-600 text-xs">
          SpeakSmart Baguio &copy; 2026
        </footer>
      </div>
    </main>
  );
}