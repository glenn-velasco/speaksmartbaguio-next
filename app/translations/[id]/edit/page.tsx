"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createSubmission } from "@/lib/actions";
import { fetchAPI } from "@/lib/fetch-api";
import * as Label from "@radix-ui/react-label";

export default function EditTranslationPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    english: "",
    ilokano: "",
    tagalog: "",
  });

  useEffect(() => {
    async function fetchItem() {
      try {
        const result = await fetchAPI(`/api/v1/translations?limit=1`);
        const item = result.data.find((i: any) => i.id === id);

        if (item) {
          setFormData({
            english: item.english || "",
            ilokano: item.ilokano || "",
            tagalog: item.tagalog || "",
          });
        }
      } catch (error) {
        console.error("Failed to fetch item:", error);
      } finally {
        setFetching(false);
      }
    }

    fetchItem();
  }, [id]);

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
      collection: "translations",
      action: "update",
      targetId: id,
      data: formData,
    }, token);

    setLoading(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        router.push("/translations");
      }, 2000);
    } else {
      setError(result.error);
    }
  }

  if (fetching) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Edit Submitted!</h2>
          <p className="text-gray-600 dark:text-gray-400">Your changes are pending admin approval.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Edit Translation
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Suggest changes to this translation. An admin will review before changes are published.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 space-y-6">
          <div>
            <Label.Root htmlFor="english" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              English *
            </Label.Root>
            <input
              id="english"
              type="text"
              required
              value={formData.english}
              onChange={(e) => setFormData({ ...formData, english: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <Label.Root htmlFor="ilokano" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ilokano *
            </Label.Root>
            <input
              id="ilokano"
              type="text"
              required
              value={formData.ilokano}
              onChange={(e) => setFormData({ ...formData, ilokano: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <Label.Root htmlFor="tagalog" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tagalog *
            </Label.Root>
            <input
              id="tagalog"
              type="text"
              required
              value={formData.tagalog}
              onChange={(e) => setFormData({ ...formData, tagalog: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Submitting..." : "Submit Changes"}
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
