import type { Metadata } from "next";
import EndpointCard from '@/components/EndPointCard';
import InstructionNotification from "@/components/InstructionNotification";

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
        method: "POST",
        path: "/api/v1/dictionary",
        description: "Add a new word entry.",
        params: ["Body: ilokanoWord, englishTranslation, tagalogTranslation, partOfSpeech, category"]
      },
      {
        method: "PUT",
        path: "/api/v1/dictionary",
        description: "Update a word by ID.",
        params: ["Body: id (required), ...fields to update"]
      },
      {
        method: "DELETE",
        path: "/api/v1/dictionary?id=...",
        description: "Delete a word permanently by ID.",
        params: ["id (query param)"]
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
        method: "POST",
        path: "/api/v1/phrasebook",
        description: "Add a new phrase entry.",
        params: ["Body: ilokanoWord, englishTranslation, tagalogTranslation, partOfSpeech"]
      },
      {
        method: "PUT",
        path: "/api/v1/phrasebook",
        description: "Update a phrase by ID.",
        params: ["Body: id (required), ...fields to update"]
      },
      {
        method: "DELETE",
        path: "/api/v1/phrasebook?id=...",
        description: "Delete a phrase permanently by ID.",
        params: ["id (query param)"]
      }
    ]
  },
  {
    title: "Translation Endpoints",
    items: [
      {
        method: "GET",
        path: "/api/v1/translations",
        description: "Fetch all translations (Limit 20 by default).",
        params: ["limit", "english", "ilokano", "tagalog"]
      },
      {
        method: "GET",
        path: "/api/v1/translations?ilokano=naimbag",
        description: "Find specific translation by Ilokano word.",
        params: ["ilokano"]
      },
      {
        method: "POST",
        path: "/api/v1/translations",
        description: "Add a new direct translation.",
        params: ["Body: english, ilokano, tagalog"]
      },
      {
        method: "PUT",
        path: "/api/v1/translations",
        description: "Update a translation by ID.",
        params: ["Body: id (required), ...fields to update"]
      },
      {
        method: "DELETE",
        path: "/api/v1/translations?id=...",
        description: "Delete a translation permanently by ID.",
        params: ["id (query param)"]
      }
    ]
  }
];

export default function ApiDashboard() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-black p-4 md:p-8 font-sans transition-colors duration-300">
      <div className="max-w-6xl mx-auto">
        
        <header className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Speak Smart Baguio API v1</h1>
            <p>Built with Next.JS</p>
          </div>
        </header>

        <InstructionNotification message="All requests must include the" code="x-api-key" />

        <InstructionNotification message="To prevent cors issues set your own domain at .env variable" code="ALLOWED_ORIGINS" />

        <div className="space-y-16">
          {sections.map((section, sIndex) => (
            <section key={sIndex}>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6 border-b border-gray-200 dark:border-gray-800 pb-2">
                {section.title}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {section.items.map((ep, index) => (
                  <EndpointCard key={index} {...ep} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-16 text-center text-gray-400 dark:text-gray-600 text-xs pb-8">
          Speak Smart Baguio &copy; 2026
        </footer>
      </div>
    </main>
  );
}