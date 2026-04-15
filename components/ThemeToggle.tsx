"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { DropdownMenu, IconButton } from "@radix-ui/themes";
import { Sun, Moon, Monitor } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <IconButton variant="ghost" size="2" color="gray" highContrast>
        <Sun className="w-4 h-4" />
      </IconButton>
    );
  }

  const icon =
    theme === "dark" ? (
      <Moon className="w-4 h-4" />
    ) : theme === "light" ? (
      <Sun className="w-4 h-4" />
    ) : (
      <Monitor className="w-4 h-4" />
    );

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <IconButton
          variant="ghost"
          size="2"
          color="gray"
          highContrast
          aria-label="Toggle theme"
          id="theme-toggle"
        >
          {icon}
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" sideOffset={5}>
        <DropdownMenu.Item
          onSelect={() => setTheme("light")}
          style={{ fontWeight: theme === "light" ? 600 : 400 }}
        >
          <Sun className="w-4 h-4" />
          Light
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={() => setTheme("dark")}
          style={{ fontWeight: theme === "dark" ? 600 : 400 }}
        >
          <Moon className="w-4 h-4" />
          Dark
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onSelect={() => setTheme("system")}
          style={{ fontWeight: theme === "system" ? 600 : 400 }}
        >
          <Monitor className="w-4 h-4" />
          System
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
