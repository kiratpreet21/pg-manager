import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { residents, roomOccupancies, rooms, portions, monthlyBills, payments } from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { calcOutstanding } from "@/lib/decimal";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1. Fetch all residents
  const allResidents = await db
    .select({
      id: residents.id,
      name: residents.name,
      phone: residents.phone,
      isActive: residents.isActive,
      roomName: rooms.name,
      portionName: portions.name,
    })
    .from(residents)
    .leftJoin(
      roomOccupancies,
      and(
        eq(roomOccupancies.residentId, residents.id),
        isNull(roomOccupancies.moveOutDate)
      )
    )
    .leftJoin(rooms, eq(roomOccupancies.roomId, rooms.id))
    .leftJoin(portions, eq(rooms.portionId, portions.id))
    .orderBy(residents.name);

  // 2. Fetch all FINALIZED bills
  const finalizedBills = await db
    .select({
      residentId: monthlyBills.residentId,
      totalAmount: monthlyBills.totalAmount,
    })
    .from(monthlyBills)
    .where(eq(monthlyBills.status, "FINALIZED"));

  // 3. Fetch all payments
  const allPayments = await db
    .select({
      residentId: payments.residentId,
      amount: payments.amount,
      paymentDate: payments.paymentDate,
    })
    .from(payments)
    .orderBy(desc(payments.paymentDate));

  // 4. Calculate live balances per resident
  const report = allResidents.map((r) => {
    const residentBills = finalizedBills
      .filter((b) => b.residentId === r.id)
      .map((b) => b.totalAmount);

    const residentPayments = allPayments.filter((p) => p.residentId === r.id);
    const residentPaymentAmounts = residentPayments.map((p) => p.amount);

    const totalBilled = residentBills.reduce(
      (acc, t) => acc + Number(t),
      0
    );
    const totalPaid = residentPaymentAmounts.reduce(
      (acc, p) => acc + Number(p),
      0
    );
    const outstanding = calcOutstanding(residentBills, residentPaymentAmounts);

    const lastPayment = residentPayments[0] || null;

    return {
      residentId: r.id,
      name: r.name,
      phone: r.phone,
      isActive: r.isActive,
      roomName: r.roomName || "Exited",
      portionName: r.portionName || "—",
      totalBilled: totalBilled.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      outstanding,
      lastPaymentDate: lastPayment ? lastPayment.paymentDate : null,
      lastPaymentAmount: lastPayment ? lastPayment.amount : null,
    };
  });

  return NextResponse.json({ success: true, data: report });
}
