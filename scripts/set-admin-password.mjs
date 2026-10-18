import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import postgres from "postgres";

const newPassword = process.argv[2];

if (!newPassword || newPassword.length < 6) {
  console.log("❌ Please provide a password of at least 6 characters.");
  console.log('Example: node scripts/set-admin-password.mjs "Kirattejay@21"');
  process.exit(1);
}

const hash = await bcrypt.hash(newPassword, 12);

// 1. Update .env.local and .env using single quotes to avoid $ variable expansion
const files = [".env.local", ".env"];
for (const file of files) {
  const filePath = path.resolve(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, "utf-8");
    content = content.replace(
      /ADMIN_PASSWORD_HASH=.*/g,
      `ADMIN_PASSWORD_HASH='${hash}'`
    );
    fs.writeFileSync(filePath, content, "utf-8");
    console.log(`✓ Updated password hash in ${file}`);
  }
}

// 2. Also save to Supabase config table directly for 100% reliable login
try {
  const envContent = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf-8");
  const dbUrlMatch = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
  if (dbUrlMatch && dbUrlMatch[1]) {
    const sql = postgres(dbUrlMatch[1], { max: 1 });
    await sql`
      INSERT INTO config (key, value, updated_by)
      VALUES ('admin_password_hash', ${hash}, 'admin')
      ON CONFLICT (key) DO UPDATE
      SET value = ${hash}, updated_at = now();
    `;
    await sql.end();
    console.log("✓ Saved password hash into database config table");
  }
} catch (err) {
  console.log("Note: Could not write directly to DB:", err.message);
}

console.log(`\n✅ Password successfully set to: "${newPassword}"`);
console.log("You can now log in at http://localhost:3000/login\n");
