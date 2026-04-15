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

async function setRole(uid: string, role: UserRole): Promise<void> {
  const validRoles: UserRole[] = ["admin", "editor", "viewer"];

  if (!validRoles.includes(role)) {
    console.error(`Invalid role: "${role}"`);
    console.error(`Valid roles: ${validRoles.join(", ")}`);
    process.exit(1);
  }

  try {
    const user = await adminAuth.getUser(uid);
    console.log(`\nUser found:`);
    console.log(`   UID: ${user.uid}`);
    console.log(`   Email: ${user.email || "N/A"}`);
    console.log(`   Display Name: ${user.displayName || "N/A"}`);

    await adminAuth.setCustomUserClaims(user.uid, { role });

    console.log(`\nRole "${role}" successfully set for user ${user.uid}`);
    console.log(`\nNote: The user will need to sign out and sign back in for the new role to take effect.`);
    console.log(`   (Custom claims are embedded in ID tokens, which are refreshed on login)`);
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.log("\nUsage:");
    console.log("   npm run set-role <uid> <role>\n");
    console.log("   Example: npm run set-role abc123xyz admin\n");
    console.log("Available roles: admin, editor, viewer\n");
    process.exit(1);
  }

  const [uid, role] = args;
  await setRole(uid, role as UserRole);
}

if (require.main === module) {
  main();
}

export { setRole };
