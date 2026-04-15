"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getAllUsers } from "@/lib/actions";
import { UserRole } from "@/lib/user-roles";
import { UserManagementPanel } from "@/components/UserManagementPanel";
import { Box, Container, Heading, Text, Spinner, Flex, Card } from "@radix-ui/themes";
import { Users, ArrowLeft } from "lucide-react";
import Link from "next/link";

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

export default function UsersDashboardPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    async function fetchUsers() {
      try {
        setError(null);
        const usersData = await getAllUsers({ limit: 100 });
        setUsers(usersData as User[]);
      } catch (err: any) {
        console.error("Failed to fetch users:", err);
        setError(err.message || "Failed to load users");
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, [user, role, authLoading, router]);

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

  return (
    <Box minHeight="100vh">
      <Container size="4" px="4" py="6">
        <Box mb="6">
          <Flex align="center" gap="3" mb="1">
            <Link href="/dashboard" style={{ textDecoration: "none" }}>
              <ArrowLeft className="w-5 h-5" style={{ color: "var(--gray-8)" }} />
            </Link>
            <Heading size="7" highContrast>
              User Management
            </Heading>
          </Flex>
          <Text color="gray" size="3">
            Manage user roles and permissions
          </Text>
        </Box>

        {error && (
          <Card mb="4" style={{ background: "var(--red-2)", border: "1px solid var(--red-5)" }}>
            <Text color="red" weight="bold">Error: {error}</Text>
          </Card>
        )}

        <UserManagementPanel initialUsers={users} />
      </Container>
    </Box>
  );
}
