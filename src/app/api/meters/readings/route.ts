import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { meters, meterReadings, rooms, portions, config } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { recordAudit } from "@/lib/audit";
import { getCurrentCycleStart, getCycleEndString, isCycleStartDate } from "@/lib/billing-cycle";
import { calcMeterCost } from "@/lib/decimal";
import { format, subMonths, parseISO } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let cycleStartDate = searchParams.get("cycleStartDate");

  if (!cycleStartDate) {
    const current = getCurrentCycleStart();
    cycleStartDate = format(current, "yyyy-MM-dd");
  }

  // 1. Fetch current electricity rate from config
  const rateConfig = await db.query.config.findFirst({
    where: eq(config.key, "electricity_rate_per_unit"),
  });
  const ratePerUnit = rateConfig?.value || "10.0000";

  // 2. Fetch all 12 meters with linked room/portion details
  const allMeters = await db
    .select({
      id: meters.id,
      meterCode: meters.meterCode,
      meterType: meters.meterType,
      roomId: meters.roomId,
      roomName: rooms.name,
      roomIsActive: rooms.isActive,
      portionId: sql<number>`COALESCE(${meters.portionId}, ${rooms.portionId})`,
      portionName: portions.name,
    })
    .from(meters)
    .leftJoin(rooms, eq(meters.roomId, rooms.id))
    .leftJoin(portions, eq(sql`COALESCE(${meters.portionId}, ${rooms.portionId})`, portions.id))
    .orderBy(meters.meterCode);

  // 3. Fetch readings for this cycle
  const currentReadings = await db
    .select()
    .from(meterReadings)
    .where(eq(meterReadings.cycleStartDate, cycleStartDate));

  // 4. Fetch readings for the PREVIOUS cycle (to auto-fill opening readings)
  const previousCycleDate = format(subMonths(parseISO(cycleStartDate), 1), "yyyy-MM-dd");
  const previousReadings = await db
    .select()
    .from(meterReadings)
    .where(
      and(
        eq(meterReadings.cycleStartDate, previousCycleDate),
        eq(meterReadings.readingType, "closing")
      )
    );

  // 5. Build combined meter items
  const data = allMeters.map((m) => {
    const opening = currentReadings.find(
      (r) => r.meterId === m.id && r.readingType === "opening"
    );
    const closing = currentReadings.find(
      (r) => r.meterId === m.id && r.readingType === "closing"
    );
    const prevClosing = previousReadings.find((r) => r.meterId === m.id);

    // Auto-populate opening reading:
    // If opening reading for this cycle is already recorded, use it.
    // Otherwise, pre-fill with previous cycle's closing reading!
    const effectiveOpening = opening ? opening.readingValue : prevClosing ? prevClosing.readingValue : "";
    const effectiveClosing = closing ? closing.readingValue : "";

    let units = "0.00";
    let cost = "0.00";
    if (effectiveOpening !== "" && effectiveClosing !== "" && Number(effectiveClosing) >= Number(effectiveOpening)) {
      try {
        const result = calcMeterCost(effectiveOpening, effectiveClosing, ratePerUnit);
        units = result.unitsConsumed;
        cost = result.totalMeterCost;
      } catch (e) {
        // invalid
      }
    }

    return {
      meterId: m.id,
      meterCode: m.meterCode,
      meterType: m.meterType,
      roomId: m.roomId,
      roomName: m.roomName,
      roomIsActive: m.roomIsActive ?? true,
      portionId: m.portionId,
      portionName: m.portionName,
      openingReading: effectiveOpening,
      closingReading: effectiveClosing,
      isAutoFilledOpening: !opening && Boolean(prevClosing),
      unitsConsumed: units,
      totalCost: cost,
      isSaved: Boolean(opening && closing),
    };
  });

  return NextResponse.json({
    success: true,
    cycleStartDate,
    cycleEndDate: getCycleEndString(cycleStartDate),
    ratePerUnit,
    data,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { cycleStartDate, readings, readAt } = body;

    if (!cycleStartDate) {
      return NextResponse.json({ error: "cycleStartDate is required." }, { status: 400 });
    }

    if (!Array.isArray(readings) || readings.length === 0) {
      return NextResponse.json({ error: "No meter readings provided." }, { status: 400 });
    }

    const todayDate = readAt || format(new Date(), "yyyy-MM-dd");

    // Validate each reading
    for (const item of readings) {
      const { meterCode, openingReading, closingReading } = item;
      if (openingReading === "" || closingReading === "") continue;

      const openNum = Number(openingReading);
      const closeNum = Number(closingReading);

      if (isNaN(openNum) || openNum < 0) {
        return NextResponse.json(
          { error: `Meter ${meterCode}: Opening reading must be a non-negative number.` },
          { status: 400 }
        );
      }
      if (isNaN(closeNum) || closeNum < 0) {
        return NextResponse.json(
          { error: `Meter ${meterCode}: Closing reading must be a non-negative number.` },
          { status: 400 }
        );
      }
      if (closeNum < openNum) {
        return NextResponse.json(
          { error: `Meter ${meterCode}: Closing reading (${closeNum}) cannot be less than opening reading (${openNum}).` },
          { status: 400 }
        );
      }
    }

    // Upsert opening and closing reading for each meter
    for (const item of readings) {
      const { meterId, openingReading, closingReading } = item;
      if (openingReading !== "" && openingReading !== undefined) {
        await db
          .insert(meterReadings)
          .values({
            meterId: Number(meterId),
            cycleStartDate,
            readingType: "opening",
            readingValue: String(Number(openingReading).toFixed(2)),
            readAt: todayDate,
            recordedBy: session.user?.email || "admin",
          })
          .onConflictDoUpdate({
            target: [meterReadings.meterId, meterReadings.cycleStartDate, meterReadings.readingType],
            set: {
              readingValue: String(Number(openingReading).toFixed(2)),
              readAt: todayDate,
              recordedAt: new Date(),
              recordedBy: session.user?.email || "admin",
            },
          });
      }

      if (closingReading !== "" && closingReading !== undefined) {
        await db
          .insert(meterReadings)
          .values({
            meterId: Number(meterId),
            cycleStartDate,
            readingType: "closing",
            readingValue: String(Number(closingReading).toFixed(2)),
            readAt: todayDate,
            recordedBy: session.user?.email || "admin",
          })
          .onConflictDoUpdate({
            target: [meterReadings.meterId, meterReadings.cycleStartDate, meterReadings.readingType],
            set: {
              readingValue: String(Number(closingReading).toFixed(2)),
              readAt: todayDate,
              recordedAt: new Date(),
              recordedBy: session.user?.email || "admin",
            },
          });
      }
    }

    await recordAudit({
      tableName: "meter_readings",
      action: "INSERT",
      actor: session.user?.email || "admin",
      payload: { cycleStartDate, readingCount: readings.length },
    });

    return NextResponse.json({ success: true, message: "Readings saved successfully" });
  } catch (err: any) {
    console.error("Error saving meter readings:", err);
    return NextResponse.json({ error: err.message || "Failed to save readings" }, { status: 500 });
  }
}
