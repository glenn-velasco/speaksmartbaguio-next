"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { updateUserRoleDirect, deleteUserAccount } from "@/lib/actions";
import { UserRole } from "@/lib/user-roles";
import { UserRoleDropdown } from "@/components/UserRoleDropdown";
import {
  Card,
  Flex,
  Box,
  Text,
  Heading,
  TextField,
  Select,
  Button,
  Table,
  Avatar,
  Badge,
  Dialog,
  TextArea,
  Spinner,
} from "@radix-ui/themes";
import { Search, Trash2, AlertTriangle, UserX, Mail, Calendar, Shield } from "lucide-react";

interface User {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  emailVerified?: boolean;
  createdAt?: string;
  lastSignIn?: string;
}

interface UserManagementPanelProps {
  initialUsers?: User[];
}

export function UserManagementPanel({ initialUsers = [] }: UserManagementPanelProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [loading, setLoading] = useState(initialUsers.length === 0);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialUsers.length > 0) {
      setUsers(initialUsers);
      setLoading(false);
    }
  }, [initialUsers]);

  // Filter out the current user from the list
  const filteredUsers = users
    .filter((u) => u.uid !== user?.uid) // Hide current admin user
    .filter((user) => {
      const matchesSearch =
        !searchQuery ||
        (user.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.displayName || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole = roleFilter === "all" || user.role === roleFilter;

      return matchesSearch && matchesRole;
    });

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (!user) return;

    setActionLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const result = await updateUserRoleDirect(userId, newRole, token);

      if (result.success) {
        setUsers((prev) =>
          prev.map((u) => (u.uid === userId ? { ...u, role: newRole } : u))
        );
      } else {
        setError(result.error || "Failed to update user role");
      }
    } catch (err) {
      setError("An error occurred while updating the role");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!user || !selectedUser) return;

    setActionLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const result = await deleteUserAccount(selectedUser.uid, token);

      if (result.success) {
        setUsers((prev) => prev.filter((u) => u.uid !== selectedUser.uid));
        setDeleteConfirmOpen(false);
        setSelectedUser(null);
      } else {
        setError(result.error || "Failed to delete user");
      }
    } catch (err) {
      setError("An error occurred while deleting the user");
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case "admin":
        return "red";
      case "editor":
        return "blue";
      case "viewer":
        return "gray";
      default:
        return "gray";
    }
  };

  if (loading) {
    return (
      <Flex justify="center" align="center" py="9">
        <Spinner size="3" />
      </Flex>
    );
  }

  return (
    <Box>
      {error && (
        <Card mb="4" style={{ background: "var(--red-2)", border: "1px solid var(--red-5)" }}>
          <Flex align="center" gap="2">
            <AlertTriangle className="w-4 h-4" style={{ color: "var(--red-9)" }} />
            <Text size="2" color="red">
              {error}
            </Text>
          </Flex>
        </Card>
      )}

      {/* Search and Filter Controls */}
      <Card mb="4">
        <Flex gap="3" wrap="wrap">
          <Box style={{ flex: 1, minWidth: "200px" }}>
            <TextField.Root
              placeholder="Search by email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="3"
            >
              <TextField.Slot>
                <Search className="w-4 h-4" />
              </TextField.Slot>
            </TextField.Root>
          </Box>

          <Box>
            <Select.Root
              value={roleFilter}
              onValueChange={(value) => setRoleFilter(value as UserRole | "all")}
              size="3"
            >
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="all">All Roles</Select.Item>
                <Select.Item value="admin">Admin</Select.Item>
                <Select.Item value="editor">Editor</Select.Item>
                <Select.Item value="viewer">Viewer</Select.Item>
              </Select.Content>
            </Select.Root>
          </Box>
        </Flex>

        <Flex mt="3" gap="2">
          <Text size="2" color="gray">
            Showing {filteredUsers.length} of {users.length} users
          </Text>
        </Flex>
      </Card>

      {/* Users Table */}
      {filteredUsers.length === 0 ? (
        <Card>
          <Flex direction="column" align="center" gap="3" py="6">
            <UserX className="w-12 h-12" style={{ color: "var(--gray-8)" }} />
            <Text size="3" color="gray">
              No users found
            </Text>
          </Flex>
        </Card>
      ) : (
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>User</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Role</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Last Sign In</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {filteredUsers.map((userData) => (
              <Table.Row key={userData.uid}>
                <Table.Cell>
                  <Flex align="center" gap="3">
                    <Avatar
                      src={userData.photoURL || undefined}
                      fallback={(userData.displayName || userData.email || "?")[0].toUpperCase()}
                      size="2"
                      radius="full"
                    />
                    <Box>
                      <Text size="2" weight="medium" highContrast>
                        {userData.displayName || "No name"}
                      </Text>
                    </Box>
                  </Flex>
                </Table.Cell>

                <Table.Cell>
                  <Text size="2">{userData.email}</Text>
                </Table.Cell>

                <Table.Cell>
                  <UserRoleDropdown
                    currentRole={userData.role}
                    userId={userData.uid}
                    onRoleChange={handleRoleChange}
                    disabled={actionLoading}
                  />
                </Table.Cell>

                <Table.Cell>
                  <Badge
                    color={userData.emailVerified ? "green" : "yellow"}
                    variant="soft"
                  >
                    {userData.emailVerified ? "Verified" : "Unverified"}
                  </Badge>
                </Table.Cell>

                <Table.Cell>
                  <Text size="2" color="gray">
                    {userData.lastSignIn
                      ? new Date(userData.lastSignIn).toLocaleDateString()
                      : "Never"}
                  </Text>
                </Table.Cell>

                <Table.Cell>
                  <Flex gap="2">
                    <Button
                      size="2"
                      variant="soft"
                      color="red"
                      onClick={() => {
                        setSelectedUser(userData);
                        setDeleteConfirmOpen(true);
                      }}
                      // disabled={actionLoading || userData.uid === user?.uid}
                      disabled
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <Dialog.Content maxWidth="450px">
          <Dialog.Title size="5">Delete User</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Are you sure you want to delete this user? This action cannot be undone.
          </Dialog.Description>

          {selectedUser && (
            <Card mb="4">
              <Flex align="center" gap="3">
                <Avatar
                  src={selectedUser.photoURL || undefined}
                  fallback={(selectedUser.displayName || selectedUser.email || "?")[0].toUpperCase()}
                  size="3"
                  radius="full"
                />
                <Box>
                  <Text size="2" weight="medium" highContrast>
                    {selectedUser.displayName || "No name"}
                  </Text>
                  <Text size="2" color="gray">
                    {selectedUser.email}
                  </Text>
                </Box>
              </Flex>
            </Card>
          )}

          <Flex gap="3" mt="4">
            <Button
              color="red"
              onClick={handleDeleteUser}
              disabled={actionLoading}
              size="3"
              style={{ flex: 1 }}
            >
              {actionLoading ? "Deleting..." : "Delete User"}
            </Button>
            <Button
              variant="soft"
              color="gray"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={actionLoading}
              size="3"
              style={{ flex: 1 }}
            >
              Cancel
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
}
