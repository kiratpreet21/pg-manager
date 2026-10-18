import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { 
  monthlyBills, 
  billLineItems, 
  residents, 
  rooms, 
  portions 
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { calculateCycleBills } from "@/lib/billing";
import { getCycleEndString, getCurrentCycleStart } from "@/lib/billing-cycle";
import { recordAudit } from "@/lib/audit";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let cycleStartDate = searchParams.get("cycleStartDate");

  if (!cycleStartDate) {
    const current = getCurrentCycleStart();
    cycleStartDate = format(current, "yyyy-MM-dd");
  }

  // 1. Fetch existing saved bills for this cycle
  const existingBills = await db
    .select({
      id: monthlyBills.id,
      residentId: monthlyBills.residentId,
      residentName: residents.name,
      cycleStartDate: monthlyBills.cycleStartDate,
      cycleEndDate: monthlyBills.cycleEndDate,
      status: monthlyBills.status,
      baseRent: monthlyBills.baseRent,
      foodCharge: monthlyBills.foodCharge,
      hasFood: monthlyBills.hasFood,
      electricityCharge: monthlyBills.electricityCharge,
      otherCharges: monthlyBills.otherCharges,
      otherCredits: monthlyBills.otherCredits,
      totalAmount: monthlyBills.totalAmount,
      finalizedAt: monthlyBills.finalizedAt,
      createdAt: monthlyBills.createdAt,
    })
    .from(monthlyBills)
    .innerJoin(residents, eq(monthlyBills.residentId, residents.id))
    .where(eq(monthlyBills.cycleStartDate, cycleStartDate))
    .orderBy(residents.name);

  // 2. Also run the calculator to see if there is any live preview data
  const preview = await calculateCycleBills(cycleStartDate);

  return NextResponse.json({
    success: true,
    cycleStartDate,
    cycleEndDate: getCycleEndString(cycleStartDate),
    bills: existingBills,
    preview: preview.results,
    missingReadings: preview.missingReadings,
    ratePerUnit: preview.ratePerUnit,
  });
}

/**
 * Generate (or regenerate) draft bills for a billing cycle.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { cycleStartDate } = await req.json();
    if (!cycleStartDate) {
      return NextResponse.json({ error: "cycleStartDate is required." }, { status: 400 });
    }

    const cycleEndDate = getCycleEndString(cycleStartDate);

    // Calculate fresh bills
    const { results, missingReadings } = await calculateCycleBills(cycleStartDate);

    if (results.length === 0) {
      return NextResponse.json(
        { error: "No active residents found to generate bills for." },
        { status: 400 }
      );
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const item of results) {
      // Check if a finalized bill already exists for this resident and cycle
      const existing = await db.query.monthlyBills.findFirst({
        where: and(
          eq(monthlyBills.residentId, item.residentId),
          eq(monthlyBills.cycleStartDate, cycleStartDate)
        ),
      });

      if (existing && existing.status === "FINALIZED") {
        // Finalized bills must NEVER be overwritten!
        continue;
      }

      let billId: number;

      if (existing) {
        // Update existing DRAFT bill
        await db
          .update(monthlyBills)
          .set({
            baseRent: item.baseRent,
            foodCharge: item.foodCharge,
            hasFood: item.hasFood,
            electricityCharge: item.electricityCharge,
            totalAmount: item.totalAmount,
            updatedAt: new Date(),
          })
          .where(eq(monthlyBills.id, existing.id));

        billId = existing.id;
        // Delete old draft line items
        await db.delete(billLineItems).where(eq(billLineItems.billId, billId));
        updatedCount++;
      } else {
        // Create new DRAFT bill
        const [newBill] = await db
          .insert(monthlyBills)
          .values({
            residentId: item.residentId,
            cycleStartDate,
            cycleEndDate,
            status: "DRAFT",
            baseRent: item.baseRent,
            foodCharge: item.foodCharge,
            hasFood: item.hasFood,
            electricityCharge: item.electricityCharge,
            otherCharges: "0.00",
            otherCredits: "0.00",
            totalAmount: item.totalAmount,
          })
          .returning();

        billId = newBill.id;
        createdCount++;
      }

      // Insert line items
      for (const line of item.lineItems) {
        await db.insert(billLineItems).values({
          billId,
          meterId: line.meterId,
          meterCode: line.meterCode,
          meterType: line.meterType,
          openingReading: line.openingReading,
          closingReading: line.closingReading,
          unitsConsumed: line.unitsConsumed,
          ratePerUnit: line.ratePerUnit,
          totalMeterCost: line.totalMeterCost,
          eligibleResidents: line.eligibleResidents,
          residentShare: line.residentShare,
        });
      }
    }

    await recordAudit({
      tableName: "monthly_bills",
      action: "INSERT",
      actor: session.user?.email || "admin",
      payload: { cycleStartDate, createdCount, updatedCount },
    });

    return NextResponse.json({
      success: true,
      message: `Generated bills for ${createdCount + updatedCount} residents (${createdCount} new, ${updatedCount} refreshed).`,
      missingReadings,
    });
  } catch (err: any) {
    console.error("Error generating bills:", err);
    return NextResponse.json({ error: err.message || "Failed to generate bills" }, { status: 500 });
  }
}
