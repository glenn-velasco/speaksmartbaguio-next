"use client";

import { useState, useEffect } from "react";
import { useRouter, redirect } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSubmissions, reviewSubmission, SubmissionStatus, CollectionType, getRoleRequests } from "@/lib/actions";
import { Tabs, Dialog, Button, Card, Heading, Text, Badge, Flex, Box, Container, Spinner, TextArea } from "@radix-ui/themes";
import { Plus, Pencil, Trash2, Users, UserCheck } from "lucide-react";
import Link from "next/link";
import { RoleRequestsPanel } from "@/components/RoleRequestsPanel";

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
  const [activeTab, setActiveTab] = useState<"submissions" | "users" | "role-requests">("submissions");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<SubmissionStatus | "all">("all");
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      redirect("/login");
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
      
      if (action === "approve" && result.itemId) {
        const collection = result.collection || selectedSubmission.collection;
        const itemId = result.itemId;
        console.log("[Dashboard] Redirecting to:", `/${collection}/${itemId}`, { result });
        router.push(`/${collection}/${itemId}`);
        return;
      }

      const statusFilter = filterStatus === "all" ? undefined : filterStatus;
      const data = await getSubmissions(statusFilter);
      setSubmissions(data as Submission[]);
    }
  }

  if (authLoading || loading) {
    return (
      <Flex minHeight="100vh" align="center" justify="center">
        <Spinner size="3" />
      </Flex>
    );
  }

  if (!user || role !== "admin") {
    return null;
  }

  const statusColors: Record<string, "yellow" | "green" | "red"> = {
    pending: "yellow",
    approved: "green",
    rejected: "red",
  };

  const actionIcons: Record<string, React.ReactNode> = {
    create: <Plus className="w-5 h-5" style={{ color: "var(--accent-9)" }} />,
    update: <Pencil className="w-5 h-5" style={{ color: "var(--yellow-9)" }} />,
    delete: <Trash2 className="w-5 h-5" style={{ color: "var(--red-9)" }} />,
  };

  return (
    <Box minHeight="100vh">
      <Container size="4" px="4" py="6">
        <Box mb="6">
          <Heading size="7" mb="1" highContrast>Admin Dashboard</Heading>
          <Text color="gray" size="3">Review and manage user submissions</Text>
        </Box>

        {/* Top-level navigation tabs */}
        <Tabs.Root value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <Tabs.List size="2" mb="5">
            <Tabs.Trigger value="submissions">
              <Flex align="center" gap="2">
                <Plus className="w-4 h-4" />
                Submissions
              </Flex>
            </Tabs.Trigger>
            <Tabs.Trigger value="users">
              <Flex align="center" gap="2">
                <Users className="w-4 h-4" />
                Users
              </Flex>
            </Tabs.Trigger>
            <Tabs.Trigger value="role-requests">
              <Flex align="center" gap="2">
                <UserCheck className="w-4 h-4" />
                Role Requests
              </Flex>
            </Tabs.Trigger>
          </Tabs.List>

          {/* Submissions Tab */}
          <Tabs.Content value="submissions">
            {/* Filter controls for submissions */}
            <Flex gap="2" mb="4">
              <Tabs.Root value={filterStatus} onValueChange={(value) => setFilterStatus(value as any)}>
                <Tabs.List size="2">
                  {["all", "pending", "approved", "rejected"].map((status) => (
                    <Tabs.Trigger key={status} value={status} style={{ textTransform: "capitalize" }}>
                      {status}
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>
              </Tabs.Root>
            </Flex>

            {loading ? (
              <Flex justify="center" py="9">
                <Spinner size="3" />
              </Flex>
            ) : submissions.length === 0 ? (
              <Flex justify="center" py="9">
                <Text color="gray">No submissions found</Text>
              </Flex>
            ) : (
              <Flex direction="column" gap="4">
                {submissions.map((submission) => (
                  <Card key={submission.id} size="3">
                    <Flex justify="between" align="start" mb="3">
                      <Flex align="center" gap="3">
                        <Flex
                          align="center"
                          justify="center"
                          p="2"
                          style={{ borderRadius: "var(--radius-full)", background: "var(--gray-a3)" }}
                        >
                          {actionIcons[submission.action]}
                        </Flex>
                        <Box>
                          <Heading size="3" highContrast style={{ textTransform: "capitalize" }}>
                            {submission.action} - {submission.collection}
                          </Heading>
                          <Text size="2" color="gray">
                            by {submission.userName || submission.userEmail}
                          </Text>
                        </Box>
                      </Flex>
                      <Flex align="center" gap="3">
                        <Badge
                          color={statusColors[submission.status]}
                          variant="soft"
                          style={{ textTransform: "capitalize" }}
                        >
                          {submission.status}
                        </Badge>
                        {submission.status === "pending" && (
                          <Button
                            size="2"
                            onClick={() => setSelectedSubmission(submission)}
                          >
                            Review
                          </Button>
                        )}
                      </Flex>
                    </Flex>

                    {submission.data && (
                      <Box mt="3" p="3" style={{ background: "var(--gray-a2)", borderRadius: "var(--radius-2)" }}>
                        <pre style={{ fontSize: "var(--font-size-2)", color: "var(--gray-11)", overflow: "auto", margin: 0 }}>
                          {JSON.stringify(submission.data, null, 2)}
                        </pre>
                      </Box>
                    )}

                    <Box mt="3">
                      <Text size="1" color="gray">
                        Submitted: {new Date(submission.createdAt).toLocaleString()}
                      </Text>
                    </Box>
                  </Card>
                ))}
              </Flex>
            )}
          </Tabs.Content>

          {/* Users Tab */}
          <Tabs.Content value="users">
            <Card>
              <Flex direction="column" align="center" gap="3" py="6">
                <Users className="w-12 h-12" style={{ color: "var(--accent-9)" }} />
                <Heading size="4" highContrast>User Management</Heading>
                <Text size="2" color="gray" mb="2">
                  Manage user roles and permissions
                </Text>
                <Button size="3" onClick={() => router.push("/dashboard/users")}>
                  <Flex align="center" gap="2">
                    <Users className="w-4 h-4" />
                    Go to User Management
                  </Flex>
                </Button>
              </Flex>
            </Card>
          </Tabs.Content>

          {/* Role Requests Tab */}
          <Tabs.Content value="role-requests">
            <RoleRequestsPanel />
          </Tabs.Content>
        </Tabs.Root>
      </Container>

      {/* Review Dialog */}
      <Dialog.Root open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <Dialog.Content maxWidth="600px">
          <Dialog.Title size="5">Review Submission</Dialog.Title>

          {selectedSubmission && (
            <Flex direction="column" gap="4" mt="4">
              <Flex align="center" gap="3">
                <Flex
                  align="center"
                  justify="center"
                  p="2"
                  style={{ borderRadius: "var(--radius-full)", background: "var(--gray-a3)" }}
                >
                  {actionIcons[selectedSubmission.action]}
                </Flex>
                <Box>
                  <Heading size="4" highContrast style={{ textTransform: "capitalize" }}>
                    {selectedSubmission.action} - {selectedSubmission.collection}
                  </Heading>
                  <Text size="2" color="gray">
                    by {selectedSubmission.userName || selectedSubmission.userEmail}
                  </Text>
                </Box>
              </Flex>

              {selectedSubmission.reason && (
                <Card variant="surface">
                  <Text size="2">
                    <Text weight="bold">Reason:</Text> {selectedSubmission.reason}
                  </Text>
                </Card>
              )}

              <Box p="3" style={{ background: "var(--gray-a2)", borderRadius: "var(--radius-2)" }}>
                <Text size="2" weight="medium" color="gray" mb="2" as="p">Data:</Text>
                <pre style={{ fontSize: "var(--font-size-2)", color: "var(--gray-11)", overflow: "auto", margin: 0 }}>
                  {JSON.stringify(selectedSubmission.data, null, 2)}
                </pre>
              </Box>

              <Box>
                <Text as="label" size="2" weight="medium" mb="2">
                  Admin Note (optional)
                </Text>
                <TextArea
                  value={adminNote}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAdminNote(e.target.value)}
                  rows={3}
                  size="3"
                />
              </Box>

              <Flex gap="3">
                <Button
                  color="green"
                  onClick={() => handleReview("approve")}
                  disabled={actionLoading}
                  size="3"
                  style={{ flex: 1 }}
                >
                  {actionLoading ? "Processing..." : "Approve"}
                </Button>
                <Button
                  color="red"
                  onClick={() => handleReview("reject")}
                  disabled={actionLoading}
                  size="3"
                  style={{ flex: 1 }}
                >
                  {actionLoading ? "Processing..." : "Reject"}
                </Button>
                <Button
                  variant="soft"
                  color="gray"
                  onClick={() => setSelectedSubmission(null)}
                  size="3"
                >
                  Cancel
                </Button>
              </Flex>
            </Flex>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
}
