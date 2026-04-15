'use client';

import { Card, Badge, Button, Code, Text, Flex, Box } from "@radix-ui/themes";

interface EndpointProps {
  method: string;
  path: string;
  description: string;
  params: string[];
}

export default function EndpointCard({ method, path, description, params }: EndpointProps) {
  return (
    <Card size="2">
      <Flex direction="column" gap="3">
        <Badge color="blue" variant="soft" size="1" style={{ alignSelf: "flex-start" }}>
          {method}
        </Badge>
        
        <Code size="3" weight="bold" style={{ wordBreak: "break-all" }}>
          {path}
        </Code>
        
        <Text size="2" color="gray">{description}</Text>

        <Flex wrap="wrap" gap="1">
          {params.map(param => (
            <Badge key={param} variant="outline" color="gray" size="1">
              {param}
            </Badge>
          ))}
        </Flex>

        <Button asChild size="2" style={{ width: "100%" }}>
          <a href={path} target="_blank">Try Endpoint</a>
        </Button>
      </Flex>
    </Card>
  );
}