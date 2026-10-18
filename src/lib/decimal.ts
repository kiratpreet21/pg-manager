/**
 * Decimal arithmetic helpers for all monetary calculations.
 *
 * Uses decimal.js to avoid IEEE 754 floating-point errors.
 * All money values should pass through these helpers before being
 * stored in the database or displayed to the user.
 *
 * Confirmed rules:
 *   - Electricity rate: ₹10 per unit
 *   - Rounding: ROUND_HALF_UP, 2 decimal places for money
 *   - Rate stored at 4 decimal places (e.g. 10.0000)
 *   - Rounding remainder (±₹0.01) goes to last resident alphabetically
 */

import Decimal from "decimal.js";

// Configure Decimal.js globally
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
});

/** Format a number or string as a 2-decimal money value */
export function toMoney(value: string | number | Decimal): Decimal {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Format a number or string as a 4-decimal rate value */
export function toRate(value: string | number | Decimal): Decimal {
  return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

/**
 * Calculate electricity cost for a single meter.
 *
 * @param openingReading - Meter reading at cycle start
 * @param closingReading - Meter reading at cycle end
 * @param ratePerUnit    - ₹ per unit (e.g. "10.0000")
 * @returns Object with unitsConsumed and totalMeterCost (both ROUND_HALF_UP, 2dp)
 */
export function calcMeterCost(
  openingReading: string,
  closingReading: string,
  ratePerUnit: string
) {
  const opening = new Decimal(openingReading);
  const closing = new Decimal(closingReading);
  const rate = new Decimal(ratePerUnit);

  if (closing.lessThan(opening)) {
    throw new Error(
      `Closing reading (${closingReading}) cannot be less than opening reading (${openingReading})`
    );
  }

  const unitsConsumed = closing.minus(opening);
  const totalMeterCost = toMoney(unitsConsumed.times(rate));

  return {
    unitsConsumed: unitsConsumed.toFixed(2),
    totalMeterCost: totalMeterCost.toFixed(2),
  };
}

/**
 * Split a total cost equally among N residents.
 * Returns each resident's share, with any rounding remainder (±₹0.01)
 * added to the last element so that sum(shares) === totalCost exactly.
 *
 * @param totalCost       - Total meter cost as a string (2dp)
 * @param numResidents    - Number of eligible residents (divisor)
 * @returns Array of share amounts (strings, 2dp), length = numResidents
 */
export function splitEqually(
  totalCost: string,
  numResidents: number
): string[] {
  if (numResidents <= 0) {
    throw new Error("numResidents must be at least 1");
  }

  const total = new Decimal(totalCost);
  const baseShare = toMoney(total.dividedBy(numResidents));
  const shares = Array(numResidents).fill(baseShare.toFixed(2));

  // Rounding reconciliation: adjust last share so sum === total exactly
  const sumOfShares = baseShare.times(numResidents);
  const remainder = toMoney(total.minus(sumOfShares));

  if (!remainder.isZero()) {
    const lastShare = toMoney(baseShare.plus(remainder));
    shares[numResidents - 1] = lastShare.toFixed(2);
  }

  return shares;
}

/**
 * Calculate a resident's complete monthly bill total.
 * All inputs are strings to ensure decimal precision.
 */
export function calcBillTotal({
  baseRent,
  foodCharge,
  electricityCharge,
  otherCharges,
  otherCredits,
}: {
  baseRent: string;
  foodCharge: string;
  electricityCharge: string;
  otherCharges: string;
  otherCredits: string;
}): string {
  const total = new Decimal(baseRent)
    .plus(foodCharge)
    .plus(electricityCharge)
    .plus(otherCharges)
    .minus(otherCredits);

  return toMoney(total).toFixed(2);
}

/**
 * Calculate outstanding balance for a resident.
 * outstanding = sum(FINALIZED bill totals) - sum(all payments)
 * Returns a signed value: positive = resident owes money; negative = overpaid.
 */
export function calcOutstanding(
  billTotals: string[],
  paymentAmounts: string[]
): string {
  const totalBilled = billTotals.reduce(
    (acc, t) => acc.plus(t),
    new Decimal(0)
  );
  const totalPaid = paymentAmounts.reduce(
    (acc, p) => acc.plus(p),
    new Decimal(0)
  );
  return toMoney(totalBilled.minus(totalPaid)).toFixed(2);
}

/**
 * Format a decimal string as Indian Rupee currency string.
 * e.g. "9875.00" → "₹9,875.00"
 */
export function formatINR(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(num);
}
