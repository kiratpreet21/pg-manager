import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { payments, residents, monthlyBills } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { recordAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const residentId = searchParams.get("residentId");

  let query = db
    .select({
      id: payments.id,
      residentId: payments.residentId,
      residentName: residents.name,
      billId: payments.billId,
      billCycleStart: monthlyBills.cycleStartDate,
      amount: payments.amount,
      paymentDate: payments.paymentDate,
      paymentMode: payments.paymentMode,
      reference: payments.reference,
      notes: payments.notes,
      recordedAt: payments.recordedAt,
      recordedBy: payments.recordedBy,
    })
    .from(payments)
    .innerJoin(residents, eq(payments.residentId, residents.id))
    .leftJoin(monthlyBills, eq(payments.billId, monthlyBills.id))
    .orderBy(desc(payments.paymentDate), desc(payments.id));

  const allPayments = await query;
  const filtered = residentId
    ? allPayments.filter((p) => p.residentId === Number(residentId))
    : allPayments;

  return NextResponse.json({ success: true, data: filtered });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { residentId, billId, amount, paymentDate, paymentMode, reference, notes } = body;

    if (!residentId || !amount || !paymentDate || !paymentMode) {
      return NextResponse.json(
        { error: "Resident, amount, payment date, and payment mode are required." },
        { status: 400 }
      );
    }

    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "Amount must be greater than zero." }, { status: 400 });
    }

    const [payment] = await db
      .insert(payments)
      .values({
        residentId: Number(residentId),
        billId: billId ? Number(billId) : null,
        amount: String(amountNum.toFixed(2)),
        paymentDate,
        paymentMode,
        reference: reference?.trim() || null,
        notes: notes?.trim() || null,
        recordedBy: session.user?.email || "admin",
      })
      .returning();

    await recordAudit({
      tableName: "payments",
      recordId: payment.id,
      action: "INSERT",
      actor: session.user?.email || "admin",
      payload: { paymentId: payment.id, residentId, amount: payment.amount, paymentMode },
    });

    return NextResponse.json({ success: true, data: payment });
  } catch (err: any) {
    console.error("Error recording payment:", err);
    return NextResponse.json({ error: err.message || "Failed to record payment" }, { status: 500 });
  }
}
