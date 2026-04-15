"use client";

import { useEffect } from "react";
import { Flex, Heading, Text, Button, Callout } from "@radix-ui/themes";
import { AlertCircle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <Flex minHeight="100vh" align="center" justify="center" p="4">
      <Flex direction="column" align="center" gap="4" style={{ maxWidth: 480 }}>
        <Heading size="6" highContrast>
          Something went wrong
        </Heading>
        <Callout.Root color="red" size="2">
          <Callout.Icon>
            <AlertCircle className="w-4 h-4" />
          </Callout.Icon>
          <Callout.Text>
            {error.message || "An unexpected error occurred"}
          </Callout.Text>
        </Callout.Root>
        <Button onClick={reset} size="3">
          Try again
        </Button>
      </Flex>
    </Flex>
  );
}
