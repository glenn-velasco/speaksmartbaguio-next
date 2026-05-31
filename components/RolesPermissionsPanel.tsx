"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { getAllRolePermissions, updateRolePermissions } from "@/lib/actions";
import { Permission, ALL_PERMISSIONS } from "@/lib/permissions";
import { UserRole } from "@/lib/user-roles";
import {
  Card,
  Flex,
  Box,
  Text,
  Heading,
  Button,
  Table,
  Checkbox,
  Spinner,
  Callout,
  Badge,
} from "@radix-ui/themes";
import { Shield, Save, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

export function RolesPermissionsPanel() {
  const { user } = useAuth();
  const [rolePermissions, setRolePermissions] = useState<Record<string, Permission[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchPermissions();
  }, []);

  async function fetchPermissions() {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllRolePermissions();
      setRolePermissions(data as Record<string, Permission[]>);
    } catch {
      setError("Failed to load role permissions");
    } finally {
      setLoading(false);
    }
  }

  const handlePermissionToggle = (role: string, permission: Permission) => {
    setRolePermissions((prev) => {
      const current = prev[role] || [];
      const updated = current.includes(permission)
        ? current.filter((p) => p !== permission)
        : [...current, permission];
      
      return { ...prev, [role]: updated };
    });
    setSuccess(null);
  };

  const handleSave = async (role: string) => {
    if (!user) return;

    setSaving(role);
    setError(null);
    setSuccess(null);

    try {
      const token = await user.getIdToken();
      const result = await updateRolePermissions(role, rolePermissions[role] || [], token);

      if (result.success) {
        setSuccess(`Permissions for ${role} updated successfully`);
      } else {
        setError(result.error || `Failed to update ${role} permissions`);
      }
    } catch {
      setError(`An error occurred while saving ${role} permissions`);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <Flex justify="center" align="center" py="9">
        <Spinner size="3" />
      </Flex>
    );
  }

  const roles: UserRole[] = ["admin", "editor", "viewer"];

  // Group permissions by category for better display
  const categories = Array.from(new Set(ALL_PERMISSIONS.map(p => p.split(':')[0])));

  return (
    <Box>
      <Flex justify="between" align="center" mb="4">
        <Box>
          <Heading size="4" mb="1">Role-Based Access Control</Heading>
          <Text size="2" color="gray">Configure granular permissions for each user role</Text>
        </Box>
        <Button variant="soft" color="gray" onClick={fetchPermissions}>
          <RefreshCw className="w-4 h-4" />
          Reload
        </Button>
      </Flex>

      {error && (
        <Callout.Root color="red" mb="4">
          <Callout.Icon><AlertCircle className="w-4 h-4" /></Callout.Icon>
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}

      {success && (
        <Callout.Root color="green" mb="4">
          <Callout.Icon><CheckCircle2 className="w-4 h-4" /></Callout.Icon>
          <Callout.Text>{success}</Callout.Text>
        </Callout.Root>
      )}

      <Flex direction="column" gap="6">
        {roles.map((role) => (
          <Card key={role} size="3">
            <Flex justify="between" align="center" mb="4">
              <Flex align="center" gap="2">
                <Shield className="w-5 h-5" style={{ color: `var(--${getRoleColor(role)}-9)` }} />
                <Heading size="4" style={{ textTransform: "capitalize" }}>
                  {role} Role
                </Heading>
                <Badge color={getRoleColor(role)} variant="soft">
                  {(rolePermissions[role] || []).length} permissions
                </Badge>
              </Flex>
              <Button 
                onClick={() => handleSave(role)} 
                disabled={!!saving}
                loading={saving === role}
              >
                <Save className="w-4 h-4" />
                Save Changes
              </Button>
            </Flex>

            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell width="200px">Category</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Permissions</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>

              <Table.Body>
                {categories.map((category) => (
                  <Table.Row key={category}>
                    <Table.RowHeaderCell style={{ textTransform: "capitalize" }}>
                      {category}
                    </Table.RowHeaderCell>
                    <Table.Cell>
                      <Flex gap="4" wrap="wrap">
                        {ALL_PERMISSIONS.filter(p => p.startsWith(`${category}:`)).map((permission) => (
                          <Flex key={permission} align="center" gap="2">
                            <Checkbox 
                              id={`${role}-${permission}`}
                              checked={(rolePermissions[role] || []).includes(permission)}
                              onCheckedChange={() => handlePermissionToggle(role, permission)}
                            />
                            <Text as="label" htmlFor={`${role}-${permission}`} size="2">
                              {permission.split(':')[1]}
                            </Text>
                          </Flex>
                        ))}
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Card>
        ))}
      </Flex>
    </Box>
  );
}

function getRoleColor(role: string): "red" | "blue" | "gray" {
  switch (role) {
    case "admin": return "red";
    case "editor": return "blue";
    default: return "gray";
  }
}
