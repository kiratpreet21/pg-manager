import { db } from "@/db";
import { 
  residents, 
  roomOccupancies, 
  rooms, 
  portions, 
  meters, 
  meterReadings, 
  foodPreferences, 
  monthlyBills, 
  billLineItems, 
  config 
} from "@/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { 
  toMoney, 
  calcMeterCost, 
  splitEqually, 
  calcBillTotal, 
  formatINR 
} from "./decimal";
import { getCycleEndString } from "./billing-cycle";
import Decimal from "decimal.js";

export interface CalculationResult {
  residentId: number;
  residentName: string;
  roomName: string;
  portionName: string;
  baseRent: string;
  foodCharge: string;
  hasFood: boolean;
  electricityCharge: string;
  roomElecShare: string;
  kitchenElecShare: string;
  totalAmount: string;
  lineItems: {
    meterId: number;
    meterCode: string;
    meterType: "room" | "kitchen";
    openingReading: string;
    closingReading: string;
    unitsConsumed: string;
    ratePerUnit: string;
    totalMeterCost: string;
    eligibleResidents: number;
    residentShare: string;
  }[];
}

/**
 * Calculates bills for all active residents for a given 15th-to-15th billing cycle.
 */
export async function calculateCycleBills(cycleStartDate: string): Promise<{
  success: boolean;
  ratePerUnit: string;
  baseRentDefault: string;
  foodChargeDefault: string;
  results: CalculationResult[];
  missingReadings: string[];
}> {
  // 1. Fetch config values
  const allConfigs = await db.select().from(config);
  const ratePerUnit =
    allConfigs.find((c) => c.key === "electricity_rate_per_unit")?.value || "10.0000";
  const baseRentDefault =
    allConfigs.find((c) => c.key === "base_rent")?.value || "5500.00";
  const foodChargeDefault =
    allConfigs.find((c) => c.key === "food_charge")?.value || "2500.00";

  // 2. Fetch all 12 meters
  const allMeters = await db.select().from(meters);

  // 3. Fetch readings for this cycle
  const readings = await db
    .select()
    .from(meterReadings)
    .where(eq(meterReadings.cycleStartDate, cycleStartDate));

  // 4. Fetch all active residents and their room assignments
  const activeOccupancies = await db
    .select({
      occupancyId: roomOccupancies.id,
      residentId: roomOccupancies.residentId,
      residentName: residents.name,
      roomId: roomOccupancies.roomId,
      roomName: rooms.name,
      roomIsActive: rooms.isActive,
      roomSingleRent: rooms.singleRent,
      customRent: roomOccupancies.customRent,
      portionId: rooms.portionId,
      portionName: portions.name,
    })
    .from(roomOccupancies)
    .innerJoin(residents, eq(roomOccupancies.residentId, residents.id))
    .innerJoin(rooms, eq(roomOccupancies.roomId, rooms.id))
    .innerJoin(portions, eq(rooms.portionId, portions.id))
    .where(and(eq(residents.isActive, true), isNull(roomOccupancies.moveOutDate)))
    .orderBy(residents.name);

  // 5. Fetch food preferences for this cycle
  const foodPrefs = await db
    .select()
    .from(foodPreferences)
    .where(eq(foodPreferences.cycleStartDate, cycleStartDate));

  // 6. Precompute cost and share for every meter
  // Map of meterId -> { unitsConsumed, totalCost, opening, closing }
  const meterCalculations: Record<
    number,
    {
      meter: typeof allMeters[0];
      unitsConsumed: string;
      totalCost: string;
      openingReading: string;
      closingReading: string;
      hasReadings: boolean;
    }
  > = {};

  const missingReadings: string[] = [];

  for (const m of allMeters) {
    const opening = readings.find(
      (r) => r.meterId === m.id && r.readingType === "opening"
    );
    const closing = readings.find(
      (r) => r.meterId === m.id && r.readingType === "closing"
    );

    if (opening && closing && Number(closing.readingValue) >= Number(opening.readingValue)) {
      const calc = calcMeterCost(
        opening.readingValue,
        closing.readingValue,
        ratePerUnit
      );
      meterCalculations[m.id] = {
        meter: m,
        unitsConsumed: calc.unitsConsumed,
        totalCost: calc.totalMeterCost,
        openingReading: opening.readingValue,
        closingReading: closing.readingValue,
        hasReadings: true,
      };
    } else {
      meterCalculations[m.id] = {
        meter: m,
        unitsConsumed: "0.00",
        totalCost: "0.00",
        openingReading: opening?.readingValue || "0.00",
        closingReading: closing?.readingValue || "0.00",
        hasReadings: false,
      };
      // Only report missing reading if meter belongs to an active portion/room with occupants
      missingReadings.push(m.meterCode);
    }
  }

  // 7. Calculate individual shares
  const results: CalculationResult[] = [];

  for (const occ of activeOccupancies) {
    // A. Food preference
    const pref = foodPrefs.find((f) => f.residentId === occ.residentId);
    const hasFood = pref ? pref.hasFood : true; // default true if not set
    const foodCharge = hasFood ? foodChargeDefault : "0.00";

    // B. Room electricity
    const roomMeter = allMeters.find(
      (m) => m.meterType === "room" && m.roomId === occ.roomId
    );
    const roomOccupants = activeOccupancies.filter(
      (o) => o.roomId === occ.roomId
    );
    const roomCalc = roomMeter ? meterCalculations[roomMeter.id] : null;

    let roomShare = "0.00";
    const lineItems: CalculationResult["lineItems"] = [];

    if (roomMeter && roomCalc && roomOccupants.length > 0) {
      // Split room meter cost equally among room occupants
      const shares = splitEqually(roomCalc.totalCost, roomOccupants.length);
      const myIndex = roomOccupants.findIndex(
        (o) => o.residentId === occ.residentId
      );
      roomShare = shares[myIndex] || "0.00";

      lineItems.push({
        meterId: roomMeter.id,
        meterCode: roomMeter.meterCode,
        meterType: "room",
        openingReading: roomCalc.openingReading,
        closingReading: roomCalc.closingReading,
        unitsConsumed: roomCalc.unitsConsumed,
        ratePerUnit,
        totalMeterCost: roomCalc.totalCost,
        eligibleResidents: roomOccupants.length,
        residentShare: roomShare,
      });
    }

    // C. Kitchen electricity
    const kitchenMeter = allMeters.find(
      (m) => m.meterType === "kitchen" && m.portionId === occ.portionId
    );
    const portionOccupants = activeOccupancies.filter(
      (o) => o.portionId === occ.portionId
    );
    const kitchenCalc = kitchenMeter ? meterCalculations[kitchenMeter.id] : null;

    let kitchenShare = "0.00";
    if (kitchenMeter && kitchenCalc && portionOccupants.length > 0) {
      // Split kitchen meter cost equally among all portion occupants
      const shares = splitEqually(kitchenCalc.totalCost, portionOccupants.length);
      const myIndex = portionOccupants.findIndex(
        (o) => o.residentId === occ.residentId
      );
      kitchenShare = shares[myIndex] || "0.00";

      lineItems.push({
        meterId: kitchenMeter.id,
        meterCode: kitchenMeter.meterCode,
        meterType: "kitchen",
        openingReading: kitchenCalc.openingReading,
        closingReading: kitchenCalc.closingReading,
        unitsConsumed: kitchenCalc.unitsConsumed,
        ratePerUnit,
        totalMeterCost: kitchenCalc.totalCost,
        eligibleResidents: portionOccupants.length,
        residentShare: kitchenShare,
      });
    }

    // D. Total electricity = roomShare + kitchenShare
    const electricityTotal = toMoney(
      new Decimal(roomShare).plus(kitchenShare)
    ).toFixed(2);

    // E. Base Rent determination:
    // 1. If resident occupancy has an explicit custom rent (> 0), use that!
    // 2. If room has only 1 occupant (single occupied) and room has singleRent (> 0), use that!
    // 3. Fallback to baseRentDefault (from config: ₹5,500.00)
    let residentBaseRent = baseRentDefault;
    if (occ.customRent && Number(occ.customRent) > 0) {
      residentBaseRent = toMoney(occ.customRent).toFixed(2);
    } else if (roomOccupants.length === 1 && occ.roomSingleRent && Number(occ.roomSingleRent) > 0) {
      residentBaseRent = toMoney(occ.roomSingleRent).toFixed(2);
    }

    // F. Total bill
    const totalAmount = calcBillTotal({
      baseRent: residentBaseRent,
      foodCharge,
      electricityCharge: electricityTotal,
      otherCharges: "0.00",
      otherCredits: "0.00",
    });

    results.push({
      residentId: occ.residentId,
      residentName: occ.residentName,
      roomName: occ.roomName,
      portionName: occ.portionName,
      baseRent: residentBaseRent,
      foodCharge,
      hasFood,
      electricityCharge: electricityTotal,
      roomElecShare: roomShare,
      kitchenElecShare: kitchenShare,
      totalAmount,
      lineItems,
    });
  }

  return {
    success: true,
    ratePerUnit,
    baseRentDefault,
    foodChargeDefault,
    results,
    missingReadings,
  };
}
