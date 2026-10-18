/**
 * One-time script to generate your admin password hash.
 * 
 * Usage:
 *   node scripts/generate-password-hash.mjs
 * 
 * Then copy the output hash into your .env.local as ADMIN_PASSWORD_HASH=...
 */

import bcrypt from "bcryptjs";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter your admin password: ", async (password) => {
  rl.close();

  if (password.length < 8) {
    console.error("❌ Password must be at least 8 characters.");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);

  console.log("\n✅ Password hash generated. Add this to your .env.local:\n");
  console.log(`ADMIN_PASSWORD_HASH="${hash}"\n`);
  console.log("⚠️  Never share or commit this hash file.");
});
