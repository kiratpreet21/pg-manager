import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { recordAudit } from "@/lib/audit";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid expense ID" }, { status: 400 });
  }

  try {
    const existing = await db
      .select()
      .from(expenses)
      .where(eq(expenses.id, id))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    await db.delete(expenses).where(eq(expenses.id, id));

    await recordAudit({
      tableName: "expenses",
      recordId: id,
      action: "VOID",
      actor: session.user?.email || "admin",
      payload: { deletedRecord: existing[0] },
    });

    return NextResponse.json({ success: true, message: "Expense deleted successfully" });
  } catch (err: any) {
    console.error("DELETE /api/expenses/[id] error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete expense" }, { status: 500 });
  }
}
