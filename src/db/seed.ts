/**
 * ─────────────────────────────────────────────────────────────
 * Database Seed Script
 * ─────────────────────────────────────────────────────────────
 * Populates:
 *   - 4 portions (A, B, C, D)
 *   - 8 rooms (2 per portion)
 *   - 12 meters (2 room meters + 1 kitchen meter per portion)
 *   - Default config values (electricity rate, base rent, food charge)
 *   - Admin user placeholder
 *
 * Run with: npm run db:seed
 * Safe to run multiple times (uses upsert/insertOrIgnore).
 * ─────────────────────────────────────────────────────────────
 */

import "../lib/load-env";
import { db } from "./index";
import { config, portions, rooms, meters } from "./schema";
import { sql } from "drizzle-orm";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@pg.local";

async function seed() {
  console.log("🌱 Starting database seed...\n");

  // ── Config defaults ──────────────────────────────────────────
  console.log("⚙️  Seeding config...");
  const configDefaults = [
    { key: "electricity_rate_per_unit", value: "10.0000", updatedBy: "seed" },
    { key: "base_rent",                 value: "5500.00", updatedBy: "seed" },
    { key: "food_charge",               value: "2500.00", updatedBy: "seed" },
  ];

  for (const row of configDefaults) {
    await db
      .insert(config)
      .values(row)
      .onConflictDoNothing();
  }
  console.log("   ✓ Config seeded (will not overwrite existing values)\n");

  // ── Portions ─────────────────────────────────────────────────
  console.log("🏠 Seeding portions...");
  const portionData = [
    { name: "Portion A" },
    { name: "Portion B" },
    { name: "Portion C" },
    { name: "Portion D" },
  ];

  const insertedPortions = await db
    .insert(portions)
    .values(portionData)
    .onConflictDoNothing()
    .returning();

  // Re-fetch all portions (in case some already existed)
  const allPortions = await db.select().from(portions).orderBy(portions.name);
  console.log(`   ✓ ${allPortions.length} portions ready\n`);

  // ── Rooms (2 per portion) ────────────────────────────────────
  console.log("🚪 Seeding rooms...");
  const roomInserts = allPortions.flatMap((p) => {
    const letter = p.name.replace("Portion ", ""); // "A", "B", etc.
    return [
      { portionId: p.id, name: `${letter}-Room1`, capacity: 2 },
      { portionId: p.id, name: `${letter}-Room2`, capacity: 2 },
    ];
  });

  await db.insert(rooms).values(roomInserts).onConflictDoNothing();
  const allRooms = await db.select().from(rooms).orderBy(rooms.name);
  console.log(`   ✓ ${allRooms.length} rooms ready\n`);

  // ── Meters (2 room meters + 1 kitchen meter per portion) ─────
  console.log("⚡ Seeding meters...");
  const meterInserts = [];

  for (const portion of allPortions) {
    const letter = portion.name.replace("Portion ", "");
    const portionRooms = allRooms.filter((r) => r.portionId === portion.id);

    for (const room of portionRooms) {
      const roomNum = room.name.split("Room")[1]; // "1" or "2"
      meterInserts.push({
        meterCode: `${letter}-R${roomNum}`,
        meterType: "room" as const,
        roomId: room.id,
        portionId: null,
      });
    }

    // Kitchen meter for this portion
    meterInserts.push({
      meterCode: `${letter}-K`,
      meterType: "kitchen" as const,
      roomId: null,
      portionId: portion.id,
    });
  }

  await db.insert(meters).values(meterInserts).onConflictDoNothing();
  const allMeters = await db.select().from(meters).orderBy(meters.meterCode);
  console.log(`   ✓ ${allMeters.length} meters ready\n`);

  // ── Summary ──────────────────────────────────────────────────
  console.log("─────────────────────────────────────────");
  console.log("✅ Seed complete! Property structure:\n");

  for (const portion of allPortions) {
    const letter = portion.name.replace("Portion ", "");
    const portionRooms = allRooms.filter((r) => r.portionId === portion.id);
    const portionMeters = allMeters.filter(
      (m) => m.portionId === portion.id ||
             portionRooms.some((r) => r.id === m.roomId)
    );

    console.log(`📦 ${portion.name}`);
    for (const room of portionRooms) {
      const roomMeter = portionMeters.find((m) => m.roomId === room.id);
      console.log(`   🚪 ${room.name}  (capacity: ${room.capacity})  ⚡ Meter: ${roomMeter?.meterCode ?? "?"}`);
    }
    const kitchenMeter = portionMeters.find((m) => m.meterType === "kitchen");
    console.log(`   🍳 Kitchen  ⚡ Meter: ${kitchenMeter?.meterCode ?? "?"}`);
    console.log("");
  }

  console.log("─────────────────────────────────────────");
  console.log("📋 Config values:");
  const allConfig = await db.select().from(config);
  for (const c of allConfig) {
    console.log(`   ${c.key} = ${c.value}`);
  }

  console.log("\n⚠️  Next steps:");
  console.log("   1. Copy .env.example → .env.local and fill in DATABASE_URL");
  console.log("   2. Run: npm run db:generate  (generate migration)");
  console.log("   3. Run: npm run db:migrate   (apply to database)");
  console.log("   4. Run: npm run db:seed      (populate base data)");
  console.log("   5. Run: npm run dev          (start development server)");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
