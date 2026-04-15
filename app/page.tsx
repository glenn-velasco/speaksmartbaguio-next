import type { Metadata } from "next";
import Link from "next/link";
import { Book, MessageCircle, Globe } from "lucide-react";
import { Heading, Text, Button, Card, Flex, Grid, Container, Box, Badge } from "@radix-ui/themes";

export const metadata: Metadata = {
  title: "Speak Smart Baguio - Ilokano Dictionary & Translations",
  description: "Collaborative Ilokano language dictionary and translation platform",
};

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Container size="4" px="4" py="9">
        <Box mb="9" style={{ textAlign: "center" }}>
          <Heading size="9" mb="3" highContrast>
            Speak Smart Baguio
          </Heading>
          <Text size="5" color="gray" as="p" mb="6">
            A collaborative platform for learning and preserving the Ilokano language
          </Text>
          <Flex wrap="wrap" justify="center" gap="4">
            <Button asChild size="3">
              <Link href="/dictionary">Browse Dictionary</Link>
            </Button>
            <Button asChild size="3" variant="outline" highContrast>
              <Link href="/phrasebook">Explore Phrasebook</Link>
            </Button>
          </Flex>
        </Box>

        <Grid columns={{ initial: "1", md: "3" }} gap="5" mb="9">
          <Card size="3">
            <Flex direction="column" gap="3">
              <Book className="w-10 h-10" style={{ color: "var(--accent-9)" }} />
              <Heading size="5" highContrast>Dictionary</Heading>
              <Text color="gray" size="2">
                Browse and contribute to our growing collection of Ilokano words with English and Tagalog translations.
              </Text>
              <Button asChild variant="ghost" size="2" style={{ alignSelf: "flex-start" }}>
                <Link href="/dictionary">Explore →</Link>
              </Button>
            </Flex>
          </Card>

          <Card size="3">
            <Flex direction="column" gap="3">
              <MessageCircle className="w-10 h-10" style={{ color: "var(--green-9)" }} />
              <Heading size="5" highContrast>Phrasebook</Heading>
              <Text color="gray" size="2">
                Learn common Ilokano phrases and expressions for everyday conversations.
              </Text>
              <Button asChild variant="ghost" size="2" style={{ alignSelf: "flex-start" }}>
                <Link href="/phrasebook">Explore →</Link>
              </Button>
            </Flex>
          </Card>

          <Card size="3">
            <Flex direction="column" gap="3">
              <Globe className="w-10 h-10" style={{ color: "var(--purple-9)" }} />
              <Heading size="5" highContrast>Translations</Heading>
              <Text color="gray" size="2">
                Direct word translations between English, Ilokano, and Tagalog languages.
              </Text>
              <Button asChild variant="ghost" size="2" style={{ alignSelf: "flex-start" }}>
                <Link href="/translations">Explore →</Link>
              </Button>
            </Flex>
          </Card>
        </Grid>

        <Card size="3">
          <Heading size="6" align="center" mb="5" highContrast>
            How It Works
          </Heading>
          <Grid columns={{ initial: "1", md: "4" }} gap="5">
            {[
              { step: "1", title: "Sign Up", desc: "Create an account to start contributing" },
              { step: "2", title: "Contribute", desc: "Add, edit, or suggest new words and phrases" },
              { step: "3", title: "Review", desc: "Admins review all submissions for quality" },
              { step: "4", title: "Publish", desc: "Approved content goes live for everyone" },
            ].map((item) => (
              <Flex key={item.step} direction="column" align="center" gap="2" style={{ textAlign: "center" }}>
                <Flex
                  align="center"
                  justify="center"
                  width="150px"
                  height="150px"
                  style={{ borderRadius: "var(--radius-full)", background: "var(--accent-a3)" }}
                >
                  <Text size="5" weight="bold" color="indigo">{item.step}</Text>
                </Flex>
                <Heading size="3" highContrast>{item.title}</Heading>
                <Text size="2" color="gray">{item.desc}</Text>
              </Flex>
            ))}
          </Grid>
        </Card>

        <Box mt="9" style={{ textAlign: "center" }}>
          <Text size="2" color="gray">
            Speak Smart Baguio © 2026 | Preserving the Ilokano Language Together
          </Text>
        </Box>
      </Container>
    </main>
  );
}
