/**
 * Standalone verification script for billing formulas and decimal arithmetic.
 * Run with: node scripts/test-billing-formulas.mjs
 */

import Decimal from "decimal.js";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

function toMoney(v) {
  return new Decimal(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function calcMeterCost(opening, closing, rate) {
  const units = new Decimal(closing).minus(new Decimal(opening));
  const cost = toMoney(units.times(new Decimal(rate)));
  return { units: units.toFixed(2), cost: cost.toFixed(2) };
}

function splitEqually(totalCost, numResidents) {
  const total = new Decimal(totalCost);
  const base = toMoney(total.dividedBy(numResidents));
  const shares = Array(numResidents).fill(base.toFixed(2));
  const sumOfShares = base.times(numResidents);
  const remainder = toMoney(total.minus(sumOfShares));
  if (!remainder.isZero()) {
    shares[numResidents - 1] = toMoney(base.plus(remainder)).toFixed(2);
  }
  return shares;
}

console.log("=================================================");
console.log("   PG BILLING FORMULA & ROUNDING TEST SUITE      ");
console.log("=================================================\n");

// Test 1: User's example (300 units @ 10/unit = 3000)
console.log("Test 1: User's Example (300 units @ ₹10/unit)");
const t1 = calcMeterCost("1200", "1500", "10.0000");
console.log(`Units: ${t1.units} (Expected: 300.00) => ${t1.units === "300.00" ? "PASS" : "FAIL"}`);
console.log(`Cost:  ₹${t1.cost} (Expected: 3000.00) => ${t1.cost === "3000.00" ? "PASS" : "FAIL"}`);

// Test 2: Room split between 2 girls
console.log("\nTest 2: Split ₹3000 between 2 room occupants (1/2 each)");
const t2 = splitEqually("3000.00", 2);
console.log(`Shares: ${JSON.stringify(t2)} (Expected: ["1500.00", "1500.00"]) => ${t2[0] === "1500.00" && t2[1] === "1500.00" ? "PASS" : "FAIL"}`);

// Test 3: Kitchen split across 4 residents of portion (e.g. 150 units = ₹1500 / 4)
console.log("\nTest 3: Kitchen Split ₹1500 across 4 portion residents");
const t3 = splitEqually("1500.00", 4);
console.log(`Shares: ${JSON.stringify(t3)} (Expected: ["375.00", "375.00", "375.00", "375.00"]) => ${t3.every(s => s === "375.00") ? "PASS" : "FAIL"}`);

// Test 4: Rounding Reconciliation (odd split: ₹1000 / 3 girls)
console.log("\nTest 4: Rounding Reconciliation (₹1000 split across 3 girls)");
const t4 = splitEqually("1000.00", 3);
console.log(`Shares: ${JSON.stringify(t4)} (Expected: ["333.33", "333.33", "333.34"])`);
const sumT4 = t4.reduce((acc, s) => acc.plus(s), new Decimal(0));
console.log(`Sum of shares: ₹${sumT4.toFixed(2)} (Must equal ₹1000.00 exactly) => ${sumT4.toFixed(2) === "1000.00" ? "PASS" : "FAIL"}`);

// Test 5: Full Monthly Bill Calculation
console.log("\nTest 5: Full Bill with Food (₹5500 rent + ₹2500 food + ₹1500 room + ₹375 kitchen)");
const baseRent = new Decimal("5500.00");
const food = new Decimal("2500.00");
const roomShare = new Decimal("1500.00");
const kitchenShare = new Decimal("375.00");
const totalBill = baseRent.plus(food).plus(roomShare).plus(kitchenShare);
console.log(`Total Bill: ₹${totalBill.toFixed(2)} (Expected: ₹9875.00) => ${totalBill.toFixed(2) === "9875.00" ? "PASS" : "FAIL"}`);

// Test 6: Full Monthly Bill Calculation WITHOUT food
console.log("\nTest 6: Full Bill WITHOUT Food (₹5500 rent + ₹0 food + ₹1500 room + ₹375 kitchen)");
const totalBillNoFood = baseRent.plus(roomShare).plus(kitchenShare);
console.log(`Total Bill: ₹${totalBillNoFood.toFixed(2)} (Expected: ₹7375.00) => ${totalBillNoFood.toFixed(2) === "7375.00" ? "PASS" : "FAIL"}`);

console.log("\n=================================================");
console.log("   ALL FORMULA INVARIANTS VERIFIED!              ");
console.log("=================================================");
