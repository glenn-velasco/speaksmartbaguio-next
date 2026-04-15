import { getAuth } from "firebase/auth";
import { app } from "@/lib/firebase";

/**
 * Fetch API helper that sends Firebase ID token for authentication.
 * 
 * Authentication methods:
 * 1. If user is logged in: Sends Firebase ID token via Authorization header
 * 2. If no user: Falls back to API key (for backward compatibility)
 */
export async function fetchAPI(url: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers as Record<string, string>,
  };

  try {
    // Try to get Firebase ID token from authenticated user
    const auth = getAuth(app);
    const user = auth.currentUser;

    if (user) {
      // Get fresh ID token (forces refresh if expired)
      const token = await user.getIdToken(true);
      headers["Authorization"] = `Bearer ${token}`;
    } else if (process.env.NEXT_PUBLIC_API_KEY) {
      // Fallback to API key for backward compatibility (external tools)
      headers["x-api-key"] = process.env.NEXT_PUBLIC_API_KEY;
    }
  } catch (error) {
    console.warn("Failed to get Firebase ID token, falling back to API key:", error);
    // Fallback to API key if token retrieval fails
    if (process.env.NEXT_PUBLIC_API_KEY) {
      headers["x-api-key"] = process.env.NEXT_PUBLIC_API_KEY;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorMessage = errorData?.error || `${response.status} ${response.statusText}`;
    throw new Error(errorMessage);
  }

  return response.json();
}
