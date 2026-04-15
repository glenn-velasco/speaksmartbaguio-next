"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createSubmission } from "@/lib/actions";
import * as Select from "@radix-ui/react-select";
import * as Label from "@radix-ui/react-label";

function PhrasebookForm() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPhrase = searchParams.get("phrase") || searchParams.get("word");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    ilokanoWord: initialPhrase || "",
    englishTranslation: "",
    tagalogTranslation: "",
    partOfSpeech: "Phrase",
    tts_url: "",
  });

  if (!user) {
    router.push("/login");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");

    const token = await user.getIdToken();
    const result = await createSubmission({
      collection: "phrasebook",
      action: "create",
      data: formData,
    }, token);

    setLoading(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        router.push("/phrasebook");
      }, 2000);
    } else {
      setError(result.error);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Submission Created!</h2>
          <p className="text-gray-600 dark:text-gray-400">Your suggestion is pending admin approval.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Add New Phrase
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Submit a new Ilokano phrase. An admin will review before it's published.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 space-y-6">
          <div>
            <Label.Root htmlFor="ilokanoWord" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ilokano Phrase *
            </Label.Root>
            <input
              id="ilokanoWord"
              type="text"
              required
              value={formData.ilokanoWord}
              onChange={(e) => setFormData({ ...formData, ilokanoWord: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <Label.Root htmlFor="englishTranslation" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              English Translation *
            </Label.Root>
            <input
              id="englishTranslation"
              type="text"
              required
              value={formData.englishTranslation}
              onChange={(e) => setFormData({ ...formData, englishTranslation: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <Label.Root htmlFor="tagalogTranslation" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tagalog Translation *
            </Label.Root>
            <input
              id="tagalogTranslation"
              type="text"
              required
              value={formData.tagalogTranslation}
              onChange={(e) => setFormData({ ...formData, tagalogTranslation: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <Label.Root htmlFor="partOfSpeech" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Type *
            </Label.Root>
            <Select.Root value={formData.partOfSpeech} onValueChange={(value) => setFormData({ ...formData, partOfSpeech: value })}>
              <Select.Trigger className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 inline-flex items-center justify-between">
                <Select.Value />
                <Select.Icon>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
                  <Select.Viewport className="p-1">
                    {["Phrase", "Greeting", "Question", "Expression", "Other"].map((pos) => (
                      <Select.Item
                        key={pos}
                        value={pos}
                        className="px-3 py-2 text-sm cursor-pointer rounded-md data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-gray-800 outline-none"
                      >
                        <Select.ItemText>{pos.charAt(0).toUpperCase() + pos.slice(1)}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>

          <div>
            <Label.Root htmlFor="tts_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              TTS URL (optional)
            </Label.Root>
            <input
              id="tts_url"
              type="url"
              placeholder="https://..."
              value={formData.tts_url}
              onChange={(e) => setFormData({ ...formData, tts_url: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Submitting..." : "Submit for Review"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="py-2 px-4 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NewPhrasebookPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>}>
      <PhrasebookForm />
    </Suspense>
  );
}
