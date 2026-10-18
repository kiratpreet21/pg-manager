import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { expenses, payments, auditLog } from "@/db/schema";
import { sql, desc, eq, and, gte, lte } from "drizzle-orm";
import { recordAudit } from "@/lib/audit";
import { Decimal } from "decimal.js";

// Helper to auto-create table in Supabase PostgreSQL if not yet applied via drizzle-kit
let isTableInitialized = false;
async function ensureExpensesTable() {
  if (isTableInitialized) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "expenses" (
        "id" serial PRIMARY KEY NOT NULL,
        "category" text NOT NULL,
        "title" text NOT NULL,
        "amount" numeric(10, 2) NOT NULL,
        "expense_date" date NOT NULL,
        "payment_mode" text NOT NULL,
        "vendor_name" text,
        "reference" text,
        "notes" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "expenses_date_idx" ON "expenses" ("expense_date");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "expenses_category_idx" ON "expenses" ("category");`);
    isTableInitialized = true;
  } catch (err) {
    console.warn("Table ensure non-fatal warning:", err);
  }
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureExpensesTable();

  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // e.g. "2026-03" or "all"
    const category = searchParams.get("category"); // e.g. "wifi" or "all"

    const conditions = [];

    if (month && month !== "all") {
      // Month format "YYYY-MM"
      const [yearStr, monthStr] = month.split("-");
      const year = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);
      const startDate = `${year}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(year, m, 0).getDate();
      const endDate = `${year}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      conditions.push(gte(expenses.expenseDate, startDate));
      conditions.push(lte(expenses.expenseDate, endDate));
    }

    if (category && category !== "all") {
      conditions.push(eq(expenses.category, category));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const allExpenses = await db
      .select()
      .from(expenses)
      .where(whereClause)
      .orderBy(desc(expenses.expenseDate), desc(expenses.id));

    // Calculate total expenses for the selected filter
    let totalExpensesDec = new Decimal(0);
    const categoryTotals: Record<string, { total: Decimal; count: number }> = {};

    for (const exp of allExpenses) {
      const amt = new Decimal(exp.amount || "0");
      totalExpensesDec = totalExpensesDec.plus(amt);

      if (!categoryTotals[exp.category]) {
        categoryTotals[exp.category] = { total: new Decimal(0), count: 0 };
      }
      categoryTotals[exp.category].total = categoryTotals[exp.category].total.plus(amt);
      categoryTotals[exp.category].count += 1;
    }

    // Get total payments collected in the same period for Net Profit calculation
    let totalRevenueDec = new Decimal(0);
    const paymentConditions = [];
    if (month && month !== "all") {
      const [yearStr, monthStr] = month.split("-");
      const year = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);
      const startDate = `${year}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(year, m, 0).getDate();
      const endDate = `${year}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      paymentConditions.push(gte(payments.paymentDate, startDate));
      paymentConditions.push(lte(payments.paymentDate, endDate));
    }

    const matchingPayments = await db
      .select({ amount: payments.amount })
      .from(payments)
      .where(paymentConditions.length > 0 ? and(...paymentConditions) : undefined);

    for (const p of matchingPayments) {
      totalRevenueDec = totalRevenueDec.plus(new Decimal(p.amount || "0"));
    }

    const netProfitDec = totalRevenueDec.minus(totalExpensesDec);
    const profitMargin = totalRevenueDec.greaterThan(0)
      ? netProfitDec.dividedBy(totalRevenueDec).times(100).toFixed(1)
      : "0.0";

    const categoryBreakdown = Object.entries(categoryTotals).map(([cat, data]) => ({
      category: cat,
      total: data.total.toFixed(2),
      count: data.count,
      percentage: totalExpensesDec.greaterThan(0)
        ? data.total.dividedBy(totalExpensesDec).times(100).toFixed(1)
        : "0.0",
    }));

    // Sort category breakdown by highest amount
    categoryBreakdown.sort((a, b) => parseFloat(b.total) - parseFloat(a.total));

    return NextResponse.json({
      expenses: allExpenses,
      summary: {
        totalExpenses: totalExpensesDec.toFixed(2),
        totalRevenue: totalRevenueDec.toFixed(2),
        netProfit: netProfitDec.toFixed(2),
        profitMargin: `${profitMargin}%`,
        isProfitable: netProfitDec.greaterThanOrEqualTo(0),
        categoryBreakdown,
        count: allExpenses.length,
      },
    });
  } catch (err: any) {
    console.error("GET /api/expenses error:", err);
    return NextResponse.json({ error: err.message || "Failed to load expenses" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureExpensesTable();

  try {
    const body = await req.json();
    const { category, title, amount, expenseDate, paymentMode, vendorName, reference, notes } = body;

    if (!category || !title || !amount || !expenseDate || !paymentMode) {
      return NextResponse.json(
        { error: "Category, title, amount, date, and payment mode are required." },
        { status: 400 }
      );
    }

    const parsedAmount = new Decimal(amount);
    if (parsedAmount.lessThanOrEqualTo(0)) {
      return NextResponse.json({ error: "Amount must be greater than zero." }, { status: 400 });
    }

    const [inserted] = await db
      .insert(expenses)
      .values({
        category,
        title: title.trim(),
        amount: parsedAmount.toFixed(2),
        expenseDate,
        paymentMode,
        vendorName: vendorName ? vendorName.trim() : null,
        reference: reference ? reference.trim() : null,
        notes: notes ? notes.trim() : null,
      })
      .returning();

    await recordAudit({
      tableName: "expenses",
      recordId: inserted.id,
      action: "INSERT",
      actor: session.user?.email || "admin",
      payload: {
        category,
        title,
        amount: parsedAmount.toFixed(2),
        expenseDate,
        vendorName,
      },
    });

    return NextResponse.json({ success: true, expense: inserted }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/expenses error:", err);
    return NextResponse.json({ error: err.message || "Failed to create expense" }, { status: 500 });
  }
}
