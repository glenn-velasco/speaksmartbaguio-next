"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  getIdTokenResult,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { UserRole } from "@/lib/user-roles";
import { Permission } from "@/lib/permissions";
import { getRolePermissions } from "@/lib/actions";

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  permissions: Permission[];
  loading: boolean;
  hasPermission: (permission: Permission) => boolean;
  signUp: (email: string, password: string) => Promise<User>;
  login: (email: string, password: string) => Promise<User>;
  loginWithGoogle: () => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        try {
          const tokenResult = await getIdTokenResult(user, true);
          const userRole = (tokenResult.claims.role as UserRole) || "viewer";
          setRole(userRole);

          const rolePerms = await getRolePermissions(userRole);
          setPermissions(rolePerms);
        } catch (error) {
          console.error("Error fetching user role/permissions:", error);
          setRole("viewer");
          setPermissions(["dictionary:view", "phrasebook:view", "translations:view"]);
        }
      } else {
        setRole(null);
        setPermissions([]);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function signUp(email: string, password: string) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  }

  async function login(email: string, password: string) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  }

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    return userCredential.user;
  }

  async function logout() {
    await signOut(auth);
  }

  const hasPermission = (permission: Permission): boolean => {
    return permissions.includes(permission);
  };

  const value = {
    user,
    role,
    permissions,
    loading,
    hasPermission,
    signUp,
    login,
    loginWithGoogle,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
