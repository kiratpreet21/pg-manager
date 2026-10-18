import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { 
  config, 
  portions, 
  rooms, 
  residents, 
  roomOccupancies, 
  foodPreferences, 
  meters, 
  meterReadings, 
  monthlyBills, 
  billLineItems, 
  payments, 
  securityDeposits, 
  expenses,
  auditLog 
} from "@/db/schema";
import { format } from "date-fns";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [
      allConfig,
      allPortions,
      allRooms,
      allResidents,
      allOccupancies,
      allFoodPrefs,
      allMeters,
      allReadings,
      allBills,
      allLineItems,
      allPayments,
      allDeposits,
      allExpenses,
      allAudits,
    ] = await Promise.all([
      db.select().from(config),
      db.select().from(portions),
      db.select().from(rooms),
      db.select().from(residents),
      db.select().from(roomOccupancies),
      db.select().from(foodPreferences),
      db.select().from(meters),
      db.select().from(meterReadings),
      db.select().from(monthlyBills),
      db.select().from(billLineItems),
      db.select().from(payments),
      db.select().from(securityDeposits),
      db.select().from(expenses).catch(() => []),
      db.select().from(auditLog),
    ]);

    const backupPayload = {
      version: "1.1",
      timestamp: new Date().toISOString(),
      generatedBy: session.user?.email || "admin",
      propertyStats: {
        portions: allPortions.length,
        rooms: allRooms.length,
        meters: allMeters.length,
        residents: allResidents.length,
        bills: allBills.length,
        payments: allPayments.length,
        expenses: allExpenses.length,
      },
      data: {
        config: allConfig,
        portions: allPortions,
        rooms: allRooms,
        residents: allResidents,
        room_occupancies: allOccupancies,
        food_preferences: allFoodPrefs,
        meters: allMeters,
        meter_readings: allReadings,
        monthly_bills: allBills,
        bill_line_items: allLineItems,
        payments: allPayments,
        security_deposits: allDeposits,
        expenses: allExpenses,
        audit_log: allAudits,
      },
    };

    await recordAudit({
      tableName: "backup",
      action: "INSERT",
      actor: session.user?.email || "admin",
      payload: { action: "database_backup_downloaded" },
    });

    const filename = `pg_backup_${format(new Date(), "yyyyMMdd_HHmmss")}.json`;

    return new NextResponse(JSON.stringify(backupPayload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("Backup failed:", err);
    return NextResponse.json({ error: err.message || "Failed to create backup" }, { status: 500 });
  }
}
