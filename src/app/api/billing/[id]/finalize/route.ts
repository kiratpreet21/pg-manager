import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { monthlyBills, billLineItems, residents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { recordAudit } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const billId = Number(params.id);
  if (!billId) return NextResponse.json({ error: "Invalid bill ID" }, { status: 400 });

  const bill = await db.query.monthlyBills.findFirst({
    where: eq(monthlyBills.id, billId),
    with: {
      resident: true,
      lineItems: true,
    },
  });

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  if (bill.status === "FINALIZED") {
    return NextResponse.json({ error: "Bill is already finalized." }, { status: 400 });
  }

  // Create immutable snapshot of everything used in this calculation
  const snapshot = {
    finalizedAt: new Date().toISOString(),
    finalizedBy: session.user?.email || "admin",
    resident: {
      id: bill.resident.id,
      name: bill.resident.name,
      phone: bill.resident.phone,
    },
    cycleStartDate: bill.cycleStartDate,
    cycleEndDate: bill.cycleEndDate,
    baseRent: bill.baseRent,
    foodCharge: bill.foodCharge,
    hasFood: bill.hasFood,
    electricityCharge: bill.electricityCharge,
    otherCharges: bill.otherCharges,
    otherCredits: bill.otherCredits,
    otherNotes: bill.otherNotes,
    totalAmount: bill.totalAmount,
    lineItems: bill.lineItems.map((li) => ({
      meterCode: li.meterCode,
      meterType: li.meterType,
      openingReading: li.openingReading,
      closingReading: li.closingReading,
      unitsConsumed: li.unitsConsumed,
      ratePerUnit: li.ratePerUnit,
      totalMeterCost: li.totalMeterCost,
      eligibleResidents: li.eligibleResidents,
      residentShare: li.residentShare,
    })),
  };

  await db
    .update(monthlyBills)
    .set({
      status: "FINALIZED",
      snapshot,
      finalizedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(monthlyBills.id, billId));

  await recordAudit({
    tableName: "monthly_bills",
    recordId: billId,
    action: "FINALIZE",
    actor: session.user?.email || "admin",
    payload: { billId, totalAmount: bill.totalAmount },
  });

  return NextResponse.json({ success: true, message: "Bill finalized successfully" });
}
