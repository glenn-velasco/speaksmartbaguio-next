/**
 * Script to set Firebase user custom claims for role-based access control.
 * 
 * Usage:
 *   npm run set-role <uid> <role>
 * 
 * Examples:
 *   npm run set-role abc123 admin
 *   npm run set-role def456 editor
 *   npm run set-role ghi789 viewer
 * 
 * Available roles: admin, editor, viewer
 * 
 * To find a user's UID:
 *   1. Go to Firebase Console → Authentication → Users
 *   2. Find the user and copy their UID
 */

import { adminAuth } from "@/lib/firebase-admin";
import { UserRole } from "@/lib/user-roles";

function writeLine(message = "") {
  process.stdout.write(`${message}\n`);
}

async function setRole(uid: string, role: UserRole): Promise<void> {
  const validRoles: UserRole[] = ["admin", "editor", "viewer"];

  if (!validRoles.includes(role)) {
    console.error(`Invalid role: "${role}"`);
    console.error(`Valid roles: ${validRoles.join(", ")}`);
    process.exit(1);
  }

  try {
    const user = await adminAuth.getUser(uid);
    writeLine();
    writeLine("User found:");
    writeLine(`   UID: ${user.uid}`);
    writeLine(`   Email: ${user.email || "N/A"}`);
    writeLine(`   Display Name: ${user.displayName || "N/A"}`);

    await adminAuth.setCustomUserClaims(user.uid, { role });

    writeLine();
    writeLine(`Role "${role}" successfully set for user ${user.uid}`);
    writeLine();
    writeLine("Note: The user will need to sign out and sign back in for the new role to take effect.");
    writeLine("   (Custom claims are embedded in ID tokens, which are refreshed on login)");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    writeLine();
    writeLine("Usage:");
    writeLine("   npm run set-role <uid> <role>");
    writeLine();
    writeLine("   Example: npm run set-role abc123xyz admin");
    writeLine();
    writeLine("Available roles: admin, editor, viewer");
    writeLine();
    process.exit(1);
  }

  const [uid, role] = args;
  await setRole(uid, role as UserRole);
}

if (require.main === module) {
  main();
}

export { setRole };
