import { adminAuth } from "@/lib/firebase-admin";
import { UserRole } from "@/lib/user-roles";

export interface AuthenticatedUser {
  uid: string;
  email: string | undefined;
  displayName: string | undefined;
  role: UserRole;
  token: string;
}

export interface AuthError {
  error: string;
  status: number;
}

/**
 * Verify Firebase ID token and return authenticated user info.
 * @param authHeader - "Bearer <token>" or just the token string
 * @returns AuthenticatedUser or AuthError
 */
export async function verifyToken(
  authHeader: string | null
): Promise<AuthenticatedUser | AuthError> {
  if (!authHeader) {
    return { error: "Missing authentication token", status: 401 };
  }

  // Extract token from "Bearer <token>" format
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (!token) {
    return { error: "Invalid token format", status: 401 };
  }

  try {
    // Verify the ID token with Firebase Admin SDK
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Extract role from custom claims (defaults to "viewer" if not set)
    const role: UserRole = decodedToken.role || "viewer";

    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      displayName: decodedToken.name,
      role,
      token,
    };
  } catch (error: any) {
    console.error("Token verification failed:", error.message);
    return { error: "Invalid or expired token", status: 401 };
  }
}

/**
 * Require authentication - returns error if not authenticated.
 * @param authHeader - Authorization header
 * @returns AuthenticatedUser or AuthError
 */
export async function requireAuth(
  authHeader: string | null
): Promise<AuthenticatedUser | AuthError> {
  const result = await verifyToken(authHeader);

  if ("error" in result) {
    return {
      error: "Authentication required",
      status: 401,
    };
  }

  return result;
}

/**
 * Require specific role(s) - returns error if user doesn't have required role.
 * @param user - AuthenticatedUser from verifyToken/requireAuth
 * @param requiredRoles - Array of allowed roles (e.g., ["admin", "editor"])
 * @returns true or AuthError
 */
export function requireRole(
  user: AuthenticatedUser,
  requiredRoles: UserRole[]
): true | AuthError {
  if (!requiredRoles.includes(user.role)) {
    return {
      error: `Insufficient permissions. Required role(s): ${requiredRoles.join(", ")}`,
      status: 403,
    };
  }

  return true;
}

/**
 * Convenience: Require admin role only.
 */
export async function requireAdmin(
  authHeader: string | null
): Promise<AuthenticatedUser | AuthError> {
  const authResult = await requireAuth(authHeader);

  if ("error" in authResult) {
    return authResult;
  }

  const roleCheck = requireRole(authResult, ["admin"]);

  if (roleCheck !== true) {
    return roleCheck;
  }

  return authResult;
}

/**
 * Convenience: Require editor or admin role.
 */
export async function requireEditorOrAdmin(
  authHeader: string | null
): Promise<AuthenticatedUser | AuthError> {
  const authResult = await requireAuth(authHeader);

  if ("error" in authResult) {
    return authResult;
  }

  const roleCheck = requireRole(authResult, ["editor", "admin"]);

  if (roleCheck !== true) {
    return roleCheck;
  }

  return authResult;
}

/**
 * Extract role from decoded token (for use in middleware/handlers).
 */
export function getRoleFromTokenClaims(claims: any): UserRole {
  return claims.role || "viewer";
}
