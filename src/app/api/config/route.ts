import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { config, auditLog } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allConfigs = await db.select().from(config);
  const recentAudits = await db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(30);

  return NextResponse.json({
    success: true,
    configs: allConfigs,
    audits: recentAudits,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { 
      electricityRate, 
      baseRent, 
      foodCharge,
      upiId,
      payeeName,
      pgName,
      pgPhone,
    } = body;

    const actor = session.user?.email || "admin";

    // 1. Electricity rate
    if (electricityRate !== undefined) {
      const rateNum = Number(electricityRate);
      if (isNaN(rateNum) || rateNum <= 0) {
        return NextResponse.json({ error: "Electricity rate must be a positive number." }, { status: 400 });
      }
      await upsertConfig("electricity_rate_per_unit", String(rateNum.toFixed(4)), actor);
    }

    // 2. Base rent
    if (baseRent !== undefined) {
      const rentNum = Number(baseRent);
      if (isNaN(rentNum) || rentNum <= 0) {
        return NextResponse.json({ error: "Base rent must be a positive number." }, { status: 400 });
      }
      await upsertConfig("base_rent", String(rentNum.toFixed(2)), actor);
    }

    // 3. Food charge
    if (foodCharge !== undefined) {
      const foodNum = Number(foodCharge);
      if (isNaN(foodNum) || foodNum < 0) {
        return NextResponse.json({ error: "Food charge must be a non-negative number." }, { status: 400 });
      }
      await upsertConfig("food_charge", String(foodNum.toFixed(2)), actor);
    }

    // 4. UPI Details
    if (upiId !== undefined) {
      await upsertConfig("upi_id", upiId.trim(), actor);
    }

    if (payeeName !== undefined) {
      await upsertConfig("payee_name", payeeName.trim(), actor);
    }

    if (pgName !== undefined) {
      await upsertConfig("pg_name", pgName.trim(), actor);
    }

    if (pgPhone !== undefined) {
      await upsertConfig("pg_phone", pgPhone.trim(), actor);
    }

    await recordAudit({
      tableName: "config",
      action: "CONFIG_CHANGE",
      actor,
      payload: { electricityRate, baseRent, foodCharge, upiId, payeeName, pgName },
    });

    return NextResponse.json({ success: true, message: "Settings updated successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update settings" }, { status: 500 });
  }
}

async function upsertConfig(key: string, value: string, actor: string) {
  await db
    .insert(config)
    .values({
      key,
      value,
      updatedBy: actor,
    })
    .onConflictDoUpdate({
      target: [config.key],
      set: {
        value,
        updatedAt: new Date(),
        updatedBy: actor,
      },
    });
}
