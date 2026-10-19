import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { monthlyBills, billLineItems, residents, meters, rooms, portions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { calcBillTotal } from "@/lib/decimal";
import { recordAudit } from "@/lib/audit";

export async function GET(
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
      lineItems: {
        with: {
          meter: true,
        },
      },
    },
  });

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: bill });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const billId = Number(params.id);
  if (!billId) return NextResponse.json({ error: "Invalid bill ID" }, { status: 400 });

  const bill = await db.query.monthlyBills.findFirst({
    where: eq(monthlyBills.id, billId),
  });

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  // Strict constraint: Finalized bills cannot be edited
  if (bill.status === "FINALIZED") {
    return NextResponse.json(
      { error: "Cannot modify a finalized bill. If adjustments are needed, void this bill and generate a new one." },
      { status: 409 }
    );
  }

  try {
    const { baseRent, otherCharges, otherCredits, otherNotes } = await req.json();

    const newBaseRent = baseRent !== undefined && Number(baseRent) >= 0 ? String(Number(baseRent).toFixed(2)) : bill.baseRent;
    const newCharges = otherCharges !== undefined ? String(Number(otherCharges).toFixed(2)) : bill.otherCharges;
    const newCredits = otherCredits !== undefined ? String(Number(otherCredits).toFixed(2)) : bill.otherCredits;

    const newTotal = calcBillTotal({
      baseRent: newBaseRent,
      foodCharge: bill.foodCharge,
      electricityCharge: bill.electricityCharge,
      otherCharges: newCharges,
      otherCredits: newCredits,
    });

    await db
      .update(monthlyBills)
      .set({
        baseRent: newBaseRent,
        otherCharges: newCharges,
        otherCredits: newCredits,
        otherNotes: otherNotes !== undefined ? otherNotes : bill.otherNotes,
        totalAmount: newTotal,
        updatedAt: new Date(),
      })
      .where(eq(monthlyBills.id, billId));

    await recordAudit({
      tableName: "monthly_bills",
      recordId: billId,
      action: "UPDATE",
      actor: session.user?.email || "admin",
      payload: { billId, newBaseRent, newCharges, newCredits, newTotal },
    });

    return NextResponse.json({ success: true, message: "Bill updated" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update bill" }, { status: 500 });
  }
}
