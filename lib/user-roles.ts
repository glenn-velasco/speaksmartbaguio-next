import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
export type UserRole = "admin" | "editor" | "viewer";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

interface DecodedToken {
  role?: UserRole;
  [key: string]: unknown;
}

// Note: To set user roles via Custom Claims, use `setUserRole` from `@/lib/admin-roles` using server-side code.

/**
 * Get user role from decoded Firebase ID token.
 * Use this in API routes after token verification.
 * 
 * @param decodedToken - Verified Firebase ID token
 * @returns User role (defaults to "viewer" if not set)
 */
export function getRoleFromToken(decodedToken: DecodedToken): UserRole {
  return decodedToken.role || "viewer";
}

/**
 * Get user profile from Firestore (for display purposes only).
 * Role information should come from token claims, not Firestore.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return docSnap.data() as UserProfile;
}

/**
 * Create user profile in Firestore (for display purposes only).
 * Does NOT set role - use setUserRole() for that.
 */
export async function createUserProfile(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}): Promise<UserProfile> {
  const profile: Omit<UserProfile, "createdAt" | "updatedAt"> = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    role: "viewer", // Default role (actual role is in custom claims)
  };

  const docRef = doc(db, "users", user.uid);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    await setDoc(docRef, {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return {
    ...profile,
    createdAt: docSnap.exists() ? docSnap.data().createdAt : serverTimestamp(),
    updatedAt: docSnap.exists() ? docSnap.data().updatedAt : serverTimestamp(),
  } as UserProfile;
}

/**
 * Update user profile in Firestore (display name, photo, etc.).
 * Does NOT update role - use setUserRole() for that.
 */
export async function updateUserProfile(uid: string, data: Partial<Omit<UserProfile, "uid" | "createdAt" | "updatedAt">>) {
  const docRef = doc(db, "users", uid);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get users by role from Firestore (for admin UI).
 * Note: This queries Firestore profiles, not actual token claims.
 * For accurate role checks, always verify the token.
 */
export async function getUsersByRole(role: UserRole): Promise<UserProfile[]> {
  const q = query(collection(db, "users"), where("role", "==", role));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => doc.data() as UserProfile);
}

/**
 * DEPRECATED: Use token-based role checks instead.
 * These functions query Firestore which is slower than reading from token claims.
 * Kept for backward compatibility only.
 */

/** @deprecated Use getRoleFromToken() instead */
export async function isAdmin(uid: string): Promise<boolean> {
  const profile = await getUserProfile(uid);
  return profile?.role === "admin";
}

/** @deprecated Use getRoleFromToken() instead */
export async function isEditorOrAdmin(uid: string): Promise<boolean> {
  const profile = await getUserProfile(uid);
  return profile?.role === "admin" || profile?.role === "editor";
}
