"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSubmissions, reviewSubmission, SubmissionStatus, CollectionType } from "@/lib/actions";
import * as Tabs from "@radix-ui/react-tabs";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Submission {
  id: string;
  collection: CollectionType;
  action: string;
  targetId?: string;
  data: any;
  userId: string;
  userEmail: string;
  userName?: string;
  reason?: string;
  status: SubmissionStatus;
  createdAt: string;
  adminNote?: string;
}

export default function AdminDashboard() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<SubmissionStatus | "all">("all");
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (role !== "admin") {
      router.push("/");
      return;
    }

    async function fetchSubmissions() {
      const statusFilter = filterStatus === "all" ? undefined : filterStatus;
      const data = await getSubmissions(statusFilter);
      setSubmissions(data as Submission[]);
      setLoading(false);
    }

    fetchSubmissions();
  }, [user, role, authLoading, filterStatus, router]);

  async function handleReview(action: "approve" | "reject") {
    if (!selectedSubmission || !user) return;
    
    setActionLoading(true);
    const token = await user.getIdToken();
    const result = await reviewSubmission(selectedSubmission.id, action, token, adminNote || undefined);
    setActionLoading(false);

    if (result.success) {
      setSelectedSubmission(null);
      setAdminNote("");
      const statusFilter = filterStatus === "all" ? undefined : filterStatus;
      const data = await getSubmissions(statusFilter);
      setSubmissions(data as Submission[]);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || role !== "admin") {
    return null;
  }

  const statusColors = {
    pending: "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200",
    approved: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
    rejected: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
  };

  const actionIcons = {
    create: <Plus className="w-8 h-8 text-blue-500" />,
    update: <Pencil className="w-8 h-8 text-yellow-500" />,
    delete: <Trash2 className="w-8 h-8 text-red-500" />,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Admin Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Review and manage user submissions
          </p>
        </div>

        <Tabs.Root value={filterStatus} onValueChange={(value) => setFilterStatus(value as any)}>
          <Tabs.List className="flex gap-2 mb-6">
            {["all", "pending", "approved", "rejected"].map((status) => (
              <Tabs.Trigger
                key={status}
                value={status}
                className="px-4 py-2 text-sm font-medium rounded-md capitalize transition-colors data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:bg-white dark:bg-gray-900 data-[state=inactive]:text-gray-700 dark:text-gray-300 data-[state=inactive]:border data-[state=inactive]:border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {status}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          <Tabs.Content value={filterStatus}>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : submissions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 dark:text-gray-400">No submissions found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {submissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center p-2 rounded-full bg-gray-50 dark:bg-gray-800">{actionIcons[submission.action as keyof typeof actionIcons]}</span>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white capitalize">
                            {submission.action} - {submission.collection}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            by {submission.userName || submission.userEmail}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 text-xs font-medium rounded capitalize ${statusColors[submission.status]}`}>
                          {submission.status}
                        </span>
                        {submission.status === "pending" && (
                          <button
                            onClick={() => setSelectedSubmission(submission)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
                          >
                            Review
                          </button>
                        )}
                      </div>
                    </div>

                    {submission.data && (
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
                        <pre className="text-sm text-gray-700 dark:text-gray-300 overflow-x-auto">
                          {JSON.stringify(submission.data, null, 2)}
                        </pre>
                      </div>
                    )}

                    <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                      Submitted: {new Date(submission.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Tabs.Content>
        </Tabs.Root>
      </div>

      {/* Review Dialog */}
      <Dialog.Root open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Review Submission
            </Dialog.Title>
            
            {selectedSubmission && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center p-2 rounded-full bg-gray-50 dark:bg-gray-800">{actionIcons[selectedSubmission.action as keyof typeof actionIcons]}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                      {selectedSubmission.action} - {selectedSubmission.collection}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      by {selectedSubmission.userName || selectedSubmission.userEmail}
                    </p>
                  </div>
                </div>

                {selectedSubmission.reason && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Reason:</strong> {selectedSubmission.reason}
                    </p>
                  </div>
                )}

                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Data:</h4>
                  <pre className="text-sm text-gray-700 dark:text-gray-300 overflow-x-auto">
                    {JSON.stringify(selectedSubmission.data, null, 2)}
                  </pre>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Admin Note (optional)
                  </label>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => handleReview("approve")}
                    disabled={actionLoading}
                    className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? "Processing..." : "Approve"}
                  </button>
                  <button
                    onClick={() => handleReview("reject")}
                    disabled={actionLoading}
                    className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? "Processing..." : "Reject"}
                  </button>
                  <button
                    onClick={() => setSelectedSubmission(null)}
                    className="py-2 px-4 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
