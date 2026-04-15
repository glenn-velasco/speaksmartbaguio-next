/**
 * Client-side utilities for authentication.
 * These helpers work with Firebase client SDK to manage tokens.
 */

import { getAuth, getIdToken } from "firebase/auth";
import { app } from "@/lib/firebase";

/**
 * Get the current Firebase ID token.
 * Returns null if no user is logged in.
 */
export async function getFirebaseToken(): Promise<string | null> {
  const auth = getAuth(app);
  const user = auth.currentUser;

  if (!user) {
    return null;
  }

  try {
    return await getIdToken(user);
  } catch {
    return null;
  }
}

/**
 * Check if user is currently authenticated.
 */
export function isAuthenticated(): boolean {
  const auth = getAuth(app);
  return auth.currentUser !== null;
}
