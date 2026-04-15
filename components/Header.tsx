"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { DropdownMenu, Button, Avatar, Flex, Text, Box } from "@radix-ui/themes";
import { createSubmission } from "@/lib/actions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Edit } from "lucide-react";

export function Header() {
  const { user, logout, role } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

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
            <ThemeToggle />
            {user ? (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  <Button variant="ghost" color="gray" size="2" style={{ cursor: "pointer" }}>
                    <Flex align="center" gap="2">
                      {user.photoURL ? (
                        <Avatar src={user.photoURL} fallback={((user.email || user.displayName || "?")[0]).toUpperCase()} size="1" radius="full" />
                      ) : (
                        <Avatar fallback={((user.email || user.displayName || "?")[0]).toUpperCase()} size="1" color="indigo" radius="full" />
                      )}
                      <Text size="2" className="hidden md:inline">{user.email || user.displayName}</Text>
                    </Flex>
                  </Button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Content align="end" sideOffset={5}>
                  {role === 'admin' && (
                    <DropdownMenu.Item onSelect={() => router.push('/dashboard')}>
                      Dashboard
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
                          } catch (err: any) {
                            alert("✗ An error occurred while submitting the request:\n" + 
                              (err?.message || "Unknown error"));
                          }
                        }}
                      >
                        <Flex align="center" gap="2">
                          <Edit className="w-4 h-4" />
                          Request Editor Access
                        </Flex>
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator />
                    </>
                  )}

                  <DropdownMenu.Separator />
                  <DropdownMenu.Item
                    color="red"
                    onSelect={async () => {
                      await logout();
                    }}
                  >
                    Logout
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
      </div>
    </header>
  );
}
