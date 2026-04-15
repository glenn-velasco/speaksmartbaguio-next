"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { getRoleRequests, reviewSubmission } from "@/lib/actions";
import { Card, Button, Flex, Box, Text, Heading, Badge, Dialog, TextArea, Spinner } from "@radix-ui/themes";
import { UserCheck, Check, X } from "lucide-react";

interface RoleRequest {
  id: string;
  collection: string;
  action: string;
  targetId?: string;
  data: any;
  userId: string;
  userEmail: string;
  userName?: string;
  reason?: string;
  status: string;
  createdAt: string;
  adminNote?: string;
}

export function RoleRequestsPanel() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<RoleRequest | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | "all">("all");

  useEffect(() => {
    async function fetchRequests() {
      const data = await getRoleRequests(filterStatus === "all" ? undefined : filterStatus as any);
      setRequests(data as RoleRequest[]);
      setLoading(false);
    }

    fetchRequests();
  }, [filterStatus]);

  async function handleReview(action: "approve" | "reject") {
    if (!selectedRequest || !user) return;

    setActionLoading(true);
    const token = await user.getIdToken();
    const result = await reviewSubmission(selectedRequest.id, action, token, adminNote || undefined);
    setActionLoading(false);

    if (result.success) {
      setSelectedRequest(null);
      setAdminNote("");
      // Refresh the list
      const data = await getRoleRequests(filterStatus === "all" ? undefined : filterStatus as any);
      setRequests(data as RoleRequest[]);
    }
  }

  if (loading) {
    return (
      <Flex justify="center" py="9">
        <Spinner size="3" />
      </Flex>
    );
  }

  return (
    <Box>
      {/* Filter controls */}
      <Flex gap="2" mb="4">
        <Flex gap="2">
          {["all", "pending", "approved", "rejected"].map((status) => (
            <Button
              key={status}
              size="2"
              variant={filterStatus === status ? "solid" : "soft"}
              onClick={() => setFilterStatus(status)}
              style={{ textTransform: "capitalize" }}
            >
              {status}
            </Button>
          ))}
        </Flex>
      </Flex>

      {requests.length === 0 ? (
        <Card>
          <Flex direction="column" align="center" gap="3" py="6">
            <UserCheck className="w-12 h-12" style={{ color: "var(--gray-8)" }} />
            <Text size="3" color="gray">
              No role requests found
            </Text>
          </Flex>
        </Card>
      ) : (
        <Flex direction="column" gap="4">
          {requests.map((request) => (
            <Card key={request.id} size="3">
              <Flex justify="between" align="start" mb="3">
                <Flex align="center" gap="3">
                  <Flex
                    align="center"
                    justify="center"
                    p="2"
                    style={{ borderRadius: "var(--radius-full)", background: "var(--blue-a3)" }}
                  >
                    <UserCheck className="w-5 h-5" style={{ color: "var(--blue-9)" }} />
                  </Flex>
                  <Box>
                    <Heading size="3" highContrast>
                      Role Request
                    </Heading>
                    <Text size="2" color="gray">
                      by {request.userName || request.userEmail}
                    </Text>
                  </Box>
                </Flex>
                <Flex align="center" gap="3">
                  <Badge
                    color={request.status === "pending" ? "yellow" : request.status === "approved" ? "green" : "red"}
                    variant="soft"
                    style={{ textTransform: "capitalize" }}
                  >
                    {request.status}
                  </Badge>
                  {request.status === "pending" && (
                    <Button
                      size="2"
                      onClick={() => setSelectedRequest(request)}
                    >
                      Review
                    </Button>
                  )}
                </Flex>
              </Flex>

              {request.reason && (
                <Box mt="3" p="3" style={{ background: "var(--gray-a2)", borderRadius: "var(--radius-2)" }}>
                  <Text size="2">
                    <Text weight="bold">Reason:</Text> {request.reason}
                  </Text>
                </Box>
              )}

              <Box mt="3">
                <Text size="2" color="gray">
                  Requested role: <Badge color="blue">{request.data?.role || "editor"}</Badge>
                </Text>
              </Box>

              <Box mt="3">
                <Text size="1" color="gray">
                  Submitted: {new Date(request.createdAt).toLocaleString()}
                </Text>
              </Box>
            </Card>
          ))}
        </Flex>
      )}

      {/* Review Dialog */}
      <Dialog.Root open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <Dialog.Content maxWidth="600px">
          <Dialog.Title size="5">Review Role Request</Dialog.Title>

          {selectedRequest && (
            <Flex direction="column" gap="4" mt="4">
              <Flex align="center" gap="3">
                <Flex
                  align="center"
                  justify="center"
                  p="2"
                  style={{ borderRadius: "var(--radius-full)", background: "var(--blue-a3)" }}
                >
                  <UserCheck className="w-5 h-5" style={{ color: "var(--blue-9)" }} />
                </Flex>
                <Box>
                  <Heading size="4" highContrast>
                    Role Request
                  </Heading>
                  <Text size="2" color="gray">
                    by {selectedRequest.userName || selectedRequest.userEmail}
                  </Text>
                </Box>
              </Flex>

              {selectedRequest.reason && (
                <Card variant="surface">
                  <Text size="2">
                    <Text weight="bold">Reason:</Text> {selectedRequest.reason}
                  </Text>
                </Card>
              )}

              <Box>
                <Text size="2" color="gray">
                  Requested role: <Badge color="blue">{selectedRequest.data?.role || "editor"}</Badge>
                </Text>
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
                  {actionLoading ? "Processing..." : (
                    <Flex align="center" gap="2">
                      <Check className="w-4 h-4" />
                      Approve
                    </Flex>
                  )}
                </Button>
                <Button
                  color="red"
                  onClick={() => handleReview("reject")}
                  disabled={actionLoading}
                  size="3"
                  style={{ flex: 1 }}
                >
                  {actionLoading ? "Processing..." : (
                    <Flex align="center" gap="2">
                      <X className="w-4 h-4" />
                      Reject
                    </Flex>
                  )}
                </Button>
                <Button
                  variant="soft"
                  color="gray"
                  onClick={() => setSelectedRequest(null)}
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
