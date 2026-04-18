import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { UserRole } from "@/lib/user-roles";
import { Permission, DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";

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

const PERMISSIONS_CACHE_TTL = 300_000; // 5 minutes
const permissionsCache = new Map<string, { permissions: Permission[]; expiresAt: number }>();

/**
 * Get permissions for a specific role from Firestore, with fallback to defaults.
 */
export async function getPermissionsForRole(role: UserRole): Promise<Permission[]> {
  const cacheKey = `permissions:${role}`;
  const cached = permissionsCache.get(cacheKey);
  
  if (cached && cached.expiresAt > Date.now()) return cached.permissions;

  try {
    const doc = await adminDb.collection("roles").doc(role).get();
    
    if (doc.exists) {
      const data = doc.data();
      if (data && Array.isArray(data.permissions)) {
        const permissions = data.permissions as Permission[];
        permissionsCache.set(cacheKey, { permissions, expiresAt: Date.now() + PERMISSIONS_CACHE_TTL });
        return permissions;
      }
    }
    
    const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
    
    try {
      await adminDb.collection("roles").doc(role).set({
        permissions: defaultPermissions,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch {
      console.warn(`Failed to initialize default permissions for role: ${role}`);
    }

    permissionsCache.set(cacheKey, { permissions: defaultPermissions, expiresAt: Date.now() + PERMISSIONS_CACHE_TTL });
    return defaultPermissions;
  } catch (error) {
    console.error(`Error fetching permissions for role ${role}:`, error);
    return DEFAULT_ROLE_PERMISSIONS[role] || [];
  }
}

/**
 * Invalidate cached permissions for a specific role.
 */
export function invalidatePermissionsCache(role: UserRole): void {
  permissionsCache.delete(`permissions:${role}`);
}

/**
 * Check if a user has a specific permission.
 */
export async function hasPermission(
  user: AuthenticatedUser,
  permission: Permission
): Promise<boolean> {
  const permissions = await getPermissionsForRole(user.role);
  return permissions.includes(permission);
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

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (!token) {
    return { error: "Invalid token format", status: 401 };
  }

  try {

    const decodedToken = await adminAuth.verifyIdToken(token);

    const role: UserRole = decodedToken.role || "viewer";

    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      displayName: decodedToken.name,
      role,
      token,
    };
  } catch (error) {
    const err = error as Error;
    console.error("Token verification failed:", err.message);
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
 * Require specific permission - returns error if user doesn't have it.
 */
export async function requirePermission(
  authHeader: string | null,
  permission: Permission
): Promise<AuthenticatedUser | AuthError> {
  const authResult = await requireAuth(authHeader);

  if ("error" in authResult) {
    return authResult;
  }

  const allowed = await hasPermission(authResult, permission);

  if (!allowed) {
    return {
      error: `Insufficient permissions. Required: ${permission}`,
      status: 403,
    };
  }

  return authResult;
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
export function getRoleFromTokenClaims(claims: Record<string, unknown>): UserRole {
  return (claims.role as UserRole) || "viewer";
}
