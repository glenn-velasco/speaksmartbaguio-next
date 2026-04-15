"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createSubmission } from "@/lib/actions";
import { fetchAPI } from "@/lib/fetch-api";
import * as AlertDialog from "@radix-ui/react-alert-dialog";

export default function TranslationDetailPage() {
  const { user, role } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function fetchItem() {
      try {
        const result = await fetchAPI(`/api/v1/translations?limit=100`);
        const found = result.data.find((i: any) => i.id === id);
        setItem(found || null);
      } catch (error) {
        console.error("Failed to fetch translation:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchItem();
  }, [id]);

  async function handleDelete() {
    if (!user) return;

    setActionLoading(true);
    const token = await user.getIdToken();
    await createSubmission({
      collection: "translations",
      action: "delete",
      targetId: id,
      data: {},
      reason: "User requested deletion",
    }, token);
    setActionLoading(false);
    router.push("/translations");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Translation Not Found</h1>
          <Link href="/translations" className="text-blue-600 hover:text-blue-500">
            ← Back to Translations
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/translations" className="text-blue-600 hover:text-blue-500">
            ← Back to Translations
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {item.english}
              </h1>
              <span className="inline-block px-3 py-1 text-sm font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded capitalize">
                Translation
              </span>
            </div>

            {user && (
              <div className="flex gap-2">
                {(role === 'admin' || role === 'editor') && (
                  <Link
                    href={`/translations/${id}/edit`}
                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-md transition-colors"
                  >
                    Edit
                  </Link>
                )}

                {role === 'admin' && (
                  <AlertDialog.Root>
                    <AlertDialog.Trigger asChild>
                      <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors">
                        Delete
                      </button>
                    </AlertDialog.Trigger>
                    <AlertDialog.Portal>
                      <AlertDialog.Overlay className="fixed inset-0 bg-black/50" />
                      <AlertDialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                        <AlertDialog.Title className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                          Delete this translation?
                        </AlertDialog.Title>
                        <AlertDialog.Description className="text-gray-600 dark:text-gray-400 mb-6">
                          This will submit a deletion request for "{item.english}". An admin will review before it's removed.
                        </AlertDialog.Description>
                        <div className="flex gap-3">
                          <AlertDialog.Cancel asChild>
                            <button className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium rounded-md transition-colors">
                              Cancel
                            </button>
                          </AlertDialog.Cancel>
                          <AlertDialog.Action asChild>
                            <button
                              onClick={handleDelete}
                              disabled={actionLoading}
                              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md disabled:opacity-50 transition-colors"
                            >
                              {actionLoading ? "Submitting..." : "Submit Deletion"}
                            </button>
                          </AlertDialog.Action>
                        </div>
                      </AlertDialog.Content>
                    </AlertDialog.Portal>
                  </AlertDialog.Root>
                )}
              </div> 
            )}
          </div>

          <div className="space-y-6">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Ilokano</h3>
              <p className="text-xl text-blue-600 dark:text-blue-400 font-semibold">{item.ilokano}</p>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Tagalog</h3>
              <p className="text-xl text-green-600 dark:text-green-400 font-semibold">{item.tagalog}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
