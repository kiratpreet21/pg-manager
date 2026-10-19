import { db } from "@/db";
import { sql } from "drizzle-orm";

let columnsEnsured = false;

export async function ensureCustomRentColumns() {
  if (columnsEnsured) return;
  try {
    await db.execute(sql`
      ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "single_rent" numeric(10, 2);
    `);
    await db.execute(sql`
      ALTER TABLE "room_occupancies" ADD COLUMN IF NOT EXISTS "custom_rent" numeric(10, 2);
    `);
    columnsEnsured = true;
  } catch (err) {
    console.warn("Could not ensure custom rent columns (non-fatal):", err);
  }
}
