export type Permission =
  | "dictionary:view"
  | "dictionary:create"
  | "dictionary:edit"
  | "dictionary:delete"
  | "phrasebook:view"
  | "phrasebook:create"
  | "phrasebook:edit"
  | "phrasebook:delete"
  | "translations:view"
  | "translations:create"
  | "translations:edit"
  | "translations:delete"
  | "users:view"
  | "users:manage"
  | "roles:manage"
  | "submissions:review";

export const ALL_PERMISSIONS: Permission[] = [
  "dictionary:view",
  "dictionary:create",
  "dictionary:edit",
  "dictionary:delete",
  "phrasebook:view",
  "phrasebook:create",
  "phrasebook:edit",
  "phrasebook:delete",
  "translations:view",
  "translations:create",
  "translations:edit",
  "translations:delete",
  "users:view",
  "users:manage",
  "roles:manage",
  "submissions:review",
];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [...ALL_PERMISSIONS],
  editor: [
    "dictionary:view",
    "dictionary:create",
    "dictionary:edit",
    "phrasebook:view",
    "phrasebook:create",
    "phrasebook:edit",
    "translations:view",
    "translations:create",
    "translations:edit",
  ],
  viewer: [
    "dictionary:view",
    "phrasebook:view",
    "translations:view",
  ],
};
