import { Flex, Spinner, Text } from "@radix-ui/themes";

export default function Loading() {
  return (
    <Flex minHeight="100vh" align="center" justify="center">
      <Flex direction="column" align="center" gap="3">
        <Spinner size="3" />
        <Text color="gray">Loading...</Text>
      </Flex>
    </Flex>
  );
}
