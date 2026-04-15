import { getAuth } from "firebase/auth";
import { app } from "@/lib/firebase";

export async function fetchAPI(url: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers as Record<string, string>,
  };

  try {
    const auth = getAuth(app);
    const user = auth.currentUser;

    if (user) {
      const token = await user.getIdToken(true);
      headers["Authorization"] = `Bearer ${token}`;
    } else if (process.env.NEXT_PUBLIC_API_KEY) {
      headers["x-api-key"] = process.env.NEXT_PUBLIC_API_KEY;
    }
  } catch (error) {
    console.warn("Failed to get Firebase ID token, falling back to API key:", error);
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
