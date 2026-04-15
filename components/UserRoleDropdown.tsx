"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { DropdownMenu, Button, Text, Flex, Spinner } from "@radix-ui/themes";
import { UserRole } from "@/lib/user-roles";
import { Shield, User, Edit, Crown, Check } from "lucide-react";

interface UserRoleDropdownProps {
  currentRole: UserRole;
  userId: string;
  onRoleChange: (userId: string, newRole: UserRole) => Promise<void>;
  disabled?: boolean;
}

const roleConfig: Record<UserRole, { label: string; color: string; icon: React.ReactNode; description: string }> = {
  admin: {
    label: "Admin",
    color: "red",
    icon: <Crown className="w-4 h-4" />,
    description: "Full access to all features including user management",
  },
  editor: {
    label: "Editor",
    color: "blue",
    icon: <Edit className="w-4 h-4" />,
    description: "Can create, edit, and delete dictionary content",
  },
  viewer: {
    label: "Viewer",
    color: "gray",
    icon: <User className="w-4 h-4" />,
    description: "Can browse content and submit suggestions",
  },
};

export function UserRoleDropdown({ currentRole, userId, onRoleChange, disabled = false }: UserRoleDropdownProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  // Prevent users from changing their own role
  const isOwnAccount = user?.uid === userId;
  const isDisabled = disabled || isUpdating || isOwnAccount;

  const handleRoleChange = async (newRole: UserRole) => {
    if (newRole === currentRole || isOwnAccount) {
      setIsOpen(false);
      return;
    }

    setIsUpdating(true);
    try {
      await onRoleChange(userId, newRole);
    } finally {
      setIsUpdating(false);
      setIsOpen(false);
    }
  };

  const currentConfig = roleConfig[currentRole];

  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenu.Trigger>
        <Button
          variant="soft"
          size="2"
          disabled={isDisabled}
          style={{ cursor: isDisabled ? "not-allowed" : "pointer" }}
        >
          {isUpdating ? (
            <Spinner size="2" />
          ) : (
            <Flex align="center" gap="2">
              {currentConfig.icon}
              <Text size="2" weight="medium">
                {currentConfig.label}
              </Text>
              {isOwnAccount && (
                <Text size="1" color="gray" ml="1">
                  (You)
                </Text>
              )}
            </Flex>
          )}
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Content align="end" sideOffset={5}>
        <DropdownMenu.Label>
          <Text size="1" color="gray">
            Change Role
          </Text>
        </DropdownMenu.Label>

        {(Object.keys(roleConfig) as UserRole[]).map((role) => {
          const config = roleConfig[role];
          const isSelected = role === currentRole;

          return (
            <DropdownMenu.Item
              key={role}
              onSelect={() => handleRoleChange(role)}
              disabled={isUpdating || isOwnAccount}
              className="py-5"
            >
              <Flex align="center" gap="2" width="100%">
                <Flex align="center" gap="2" style={{ flex: 1 }}>
                  {config.icon}
                  <Flex direction="column">
                    <Text size="2" weight="medium">
                      {config.label}
                    </Text>
                    <Text size="1" color="gray">
                      {config.description}
                    </Text>
                  </Flex>
                </Flex>
                {isSelected && (
                  <Check className="w-4 h-4" style={{ color: "var(--accent-9)" }} />
                )}
              </Flex>
            </DropdownMenu.Item>
          );
        })}

        <DropdownMenu.Separator />
        {isOwnAccount ? (
          <DropdownMenu.Label>
            <Text size="1" color="orange">
              ⚠ You cannot change your own role. Ask another admin to modify your permissions.
            </Text>
          </DropdownMenu.Label>
        ) : (
          <DropdownMenu.Label>
            <Text size="1" color="gray">
              Note: User will need to log out and log back in for changes to take effect.
            </Text>
          </DropdownMenu.Label>
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
