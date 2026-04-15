import { adminAuth } from "@/lib/firebase-admin";
import { UserRole } from "@/lib/user-roles";

/**
 * Set user role via Firebase Auth Custom Claims.
 * This is the preferred method for role-based access control.
 * Custom claims are embedded in ID tokens and verified server-side.
 * 
 * @param uid - Firebase user UID
 * @param role - Role to assign (admin, editor, viewer)
 */
export async function setUserRole(uid: string, role: UserRole): Promise<void> {
  await adminAuth.setCustomUserClaims(uid, { role });
}
