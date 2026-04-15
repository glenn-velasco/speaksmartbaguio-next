"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { createUserProfile } from "@/lib/user-roles";
import { Flex, Heading, Text, Button, Card, Callout, Separator, Box, TextField } from "@radix-ui/themes";
import { AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, signUp, loginWithGoogle } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let user;
      if (isSignUp) {
        user = await signUp(email, password);
      } else {
        user = await login(email, password);
      }

      await createUserProfile({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      });

      router.push("/");
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setLoading(true);

    try {
      const user = await loginWithGoogle();
      await createUserProfile({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      });
      router.push("/");
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Flex minHeight="100vh" align="center" justify="center" p="4">
      <Card size="4" style={{ width: "100%", maxWidth: 440 }}>
        <Heading size="6" align="center" mb="5" highContrast>
          {isSignUp ? "Create Account" : "Sign In"}
        </Heading>

        {error && (
          <Callout.Root color="red" size="1" mb="4">
            <Callout.Icon>
              <AlertCircle className="w-4 h-4" />
            </Callout.Icon>
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        )}

        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="4">
            <Box>
              <Text as="label" htmlFor="email" size="2" weight="medium" mb="1">
                Email
              </Text>
              <TextField.Root
                id="email"
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                size="3"
              />
            </Box>

            <Box>
              <Text as="label" htmlFor="password" size="2" weight="medium" mb="1">
                Password
              </Text>
              <TextField.Root
                id="password"
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                size="3"
              />
            </Box>

            <Button type="submit" disabled={loading} size="3">
              {loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
            </Button>
          </Flex>
        </form>

        <Flex align="center" gap="3" my="4">
          <Separator size="4" style={{ flex: 1 }} />
          <Text size="2" color="gray">Or continue with</Text>
          <Separator size="4" style={{ flex: 1 }} />
        </Flex>

        <Button
          onClick={handleGoogleLogin}
          disabled={loading}
          variant="outline"
          size="3"
          style={{ width: "100%" }}
          highContrast
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Google
        </Button>

        <Text size="2" color="gray" align="center" as="p" mt="5">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <Button
            variant="ghost"
            size="2"
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </Button>
        </Text>

        <Text size="2" align="center" as="p" mt="3">
          <Button asChild variant="ghost" color="gray" size="2">
            <Link href="/">← Back to Home</Link>
          </Button>
        </Text>
      </Card>
    </Flex>
  );
}
