"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { DropdownMenu, Button, Avatar, Flex, Text, Box, Badge } from "@radix-ui/themes";
import { createSubmission } from "@/lib/actions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Edit, LayoutDashboard, LogOut, Menu, X } from "lucide-react";

export function Header() {
  const { user, logout, role, hasPermission } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/dictionary", label: "Dictionary" },
    { href: "/phrasebook", label: "Phrasebook" },
    { href: "/translations", label: "Translations" },
  ];

  return (
    <header className="sticky top-0 z-50" style={{ borderBottom: "1px solid var(--gray-a5)", background: "var(--color-background)", backdropFilter: "blur(12px)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Flex align="center" justify="between" height="56px">
          <Flex align="center" gap="6">
            <Link href="/" style={{ textDecoration: "none" }}>
              <Text size="5" weight="bold" highContrast>
                Speak Smart Baguio
              </Text>
            </Link>

            <Flex asChild gap="5" display={{ initial: "none", md: "flex" }} align="center">
              <nav>
                {navLinks.map((link) => {
                  const isActive = link.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(link.href);
                  return (
                    <Link key={link.href} href={link.href} style={{ textDecoration: "none" }}>
                      <Text
                        size="2"
                        weight={isActive ? "bold" : "medium"}
                        color={isActive ? "indigo" : "gray"}
                        highContrast={isActive}
                        style={{ transition: "color 0.15s" }}
                      >
                        {link.label}
                      </Text>
                    </Link>
                  );
                })}
              </nav>
            </Flex>
          </Flex>

          <Flex align="center" gap="3">
            <button
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <ThemeToggle />
            {user ? (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  <Button variant="ghost" color="gray" size="2" style={{ cursor: "pointer" }}>
                    {user.photoURL ? (
                      <Avatar src={user.photoURL} fallback={((user.email || user.displayName || "?")[0]).toUpperCase()} size="1" radius="full" />
                    ) : (
                      <Avatar fallback={((user.email || user.displayName || "?")[0]).toUpperCase()} size="1" color="indigo" radius="full" />
                    )}
                  </Button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Content align="end" sideOffset={8} size="2">
                  <Box px="3" py="3">
                    <Flex align="center" gap="3">
                      {user.photoURL ? (
                        <Avatar src={user.photoURL} fallback={((user.email || user.displayName || "?")[0]).toUpperCase()} size="3" radius="full" style={{ border: "2px solid var(--indigo-6)" }} />
                      ) : (
                        <Avatar fallback={((user.email || user.displayName || "?")[0]).toUpperCase()} size="3" color="indigo" radius="full" />
                      )}
                      <Flex direction="column" gap="0">
                        <Text size="2" weight="bold">{user.displayName || user.email?.split('@')[0] || 'User'}</Text>
                        <Text size="1" color="gray">{user.email}</Text>
                      </Flex>
                    </Flex>
                    <Flex mt="2" gap="2">
                      <Badge color={role === 'editor' ? 'indigo' : 'gray'} size="1">{role || 'viewer'}</Badge>
                    </Flex>
                  </Box>

                  {(hasPermission("submissions:review") || hasPermission("users:view") || hasPermission("roles:manage")) && (
                    <DropdownMenu.Item
                      onSelect={() => router.push('/dashboard')}
                      style={{ fontWeight: pathname === '/dashboard' ? '600' : '400' }}
                    >
                      <Flex align="center" gap="2">
                        <LayoutDashboard className="w-4 h-4" />
                        Dashboard
                      </Flex>
                    </DropdownMenu.Item>
                  )}

                  {role === 'viewer' && (
                    <>
                      <DropdownMenu.Item
                        color="blue"
                        onSelect={async (e: Event) => {
                          e.preventDefault();
                          if (!user) return;

                          const confirmed = window.confirm(
                            "Would you like to request editor access?\n\n" +
                            "This will submit a request for admin review. " +
                            "An admin will review and approve your request if appropriate.\n\n" +
                            "Note: You'll need to log out and log back in after approval for the new role to take effect."
                          );
                          if (!confirmed) return;

                          try {
                            const token = await user.getIdToken();
                            const result = await createSubmission({
                              collection: "roles",
                              action: "update",
                              targetId: user.uid,
                              data: { role: "editor" },
                              reason: "Requested editor access via header menu",
                            }, token);

                            if (result.success) {
                              alert("✓ Editor role request submitted successfully!\n\n" +
                                "An admin will review your request. " +
                                "You'll be able to see the status in your dashboard once approved.");
                            } else {
                              alert("✗ " + (result.error || "Failed to submit role request"));
                            }
                          } catch (err: unknown) {
                            const message = err instanceof Error ? err.message : "Unknown error";
                            alert("✗ An error occurred while submitting the request:\n" + message);
                          }
                        }}
                      >
                        <Flex align="center" gap="2">
                          <Edit className="w-4 h-4" />
                          Request Editor Access
                        </Flex>
                      </DropdownMenu.Item>
                    </>
                  )}

                  <DropdownMenu.Item
                    color="red"
                    onSelect={async () => {
                      await logout();
                    }}
                  >
                    <Flex align="center" gap="2">
                      <LogOut className="w-4 h-4" />
                      Logout
                    </Flex>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            ) : (
              <Button asChild size="2">
                <Link href="/login">Sign In</Link>
              </Button>
            )}
          </Flex>
        </Flex>

        {mobileMenuOpen && (
          <nav className="md:hidden" style={{ padding: "16px", borderTop: "1px solid var(--gray-a5)" }}>
            {navLinks.map((link) => {
              const isActive = link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    textDecoration: "none",
                    display: "block",
                    padding: "8px 0"
                  }}
                >
                  <Text
                    size="3"
                    weight={isActive ? "bold" : "medium"}
                    color={isActive ? "indigo" : "gray"}
                  >
                    {link.label}
                  </Text>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}
