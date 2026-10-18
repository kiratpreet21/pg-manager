import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { monthlyBills } from "@/db/schema";
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

  const { reason } = await req.json().catch(() => ({ reason: "Voided by admin" }));

  const bill = await db.query.monthlyBills.findFirst({
    where: eq(monthlyBills.id, billId),
  });

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  await db
    .update(monthlyBills)
    .set({
      status: "VOID",
      otherNotes: bill.otherNotes ? `${bill.otherNotes} | VOIDED: ${reason}` : `VOIDED: ${reason}`,
      updatedAt: new Date(),
    })
    .where(eq(monthlyBills.id, billId));

  await recordAudit({
    tableName: "monthly_bills",
    recordId: billId,
    action: "VOID",
    actor: session.user?.email || "admin",
    payload: { billId, reason },
  });

  return NextResponse.json({ success: true, message: "Bill marked as VOID" });
}
