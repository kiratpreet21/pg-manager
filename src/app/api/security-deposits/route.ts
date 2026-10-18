import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { securityDeposits, residents } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { recordAudit } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deposits = await db
    .select({
      id: securityDeposits.id,
      residentId: securityDeposits.residentId,
      residentName: residents.name,
      residentIsActive: residents.isActive,
      amountPaid: securityDeposits.amountPaid,
      paymentDate: securityDeposits.paymentDate,
      paymentMode: securityDeposits.paymentMode,
      reference: securityDeposits.reference,
      amountRefunded: securityDeposits.amountRefunded,
      refundDate: securityDeposits.refundDate,
      refundMode: securityDeposits.refundMode,
      refundReference: securityDeposits.refundReference,
      refundNotes: securityDeposits.refundNotes,
      status: securityDeposits.status,
      notes: securityDeposits.notes,
      createdAt: securityDeposits.createdAt,
    })
    .from(securityDeposits)
    .innerJoin(residents, eq(securityDeposits.residentId, residents.id))
    .orderBy(desc(securityDeposits.paymentDate));

  return NextResponse.json({ success: true, data: deposits });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { residentId, amountPaid, paymentDate, paymentMode, reference, notes } = body;

    if (!residentId || !amountPaid || !paymentDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [deposit] = await db
      .insert(securityDeposits)
      .values({
        residentId: Number(residentId),
        amountPaid: String(Number(amountPaid).toFixed(2)),
        paymentDate,
        paymentMode: paymentMode || "upi",
        reference: reference?.trim() || null,
        notes: notes?.trim() || null,
        status: "held",
      })
      .onConflictDoUpdate({
        target: [securityDeposits.residentId],
        set: {
          amountPaid: String(Number(amountPaid).toFixed(2)),
          paymentDate,
          paymentMode: paymentMode || "upi",
          reference: reference?.trim() || null,
          notes: notes?.trim() || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    await recordAudit({
      tableName: "security_deposits",
      recordId: deposit.id,
      action: "INSERT",
      actor: session.user?.email || "admin",
      payload: { residentId, amountPaid: deposit.amountPaid },
    });

    return NextResponse.json({ success: true, data: deposit });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to record deposit" }, { status: 500 });
  }
}
