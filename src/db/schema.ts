/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PG Manager — Complete Database Schema
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * BILLING CYCLE: 15th of month → 15th of next month (both inclusive)
 * All cycle_start_date / cycle_end_date columns are enforced to be the 15th
 * via application-layer validation (Drizzle does not support DAY() CHECK).
 *
 * MONEY: All monetary values stored as NUMERIC(10,2) via Drizzle's `numeric`.
 * RATES: Rate stored as NUMERIC(8,4) to preserve ₹10.0000 precision.
 * TIME:  All timestamps are TIMESTAMPTZ (UTC). Display in Asia/Kolkata (+05:30).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  pgTable,
  serial,
  text,
  boolean,
  date,
  smallint,
  numeric,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────
// CONFIG  (key-value singleton; one row per setting)
// ─────────────────────────────────────────────────────────────
export const config = pgTable("config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedBy: text("updated_by").notNull(),
});

/**
 * Default config rows seeded at startup:
 *   electricity_rate_per_unit  = "10.0000"   (₹10 per unit — confirmed)
 *   base_rent                  = "5500.00"
 *   food_charge                = "2500.00"
 */

// ─────────────────────────────────────────────────────────────
// PORTIONS  (4 portions in the property)
// ─────────────────────────────────────────────────────────────
export const portions = pgTable("portions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),   // "Portion A", "Portion B", etc.
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const portionsRelations = relations(portions, ({ many }) => ({
  rooms: many(rooms),
  meters: many(meters),
}));

// ─────────────────────────────────────────────────────────────
// ROOMS  (2 rooms per portion = 8 rooms total)
// ─────────────────────────────────────────────────────────────
export const rooms = pgTable(
  "rooms",
  {
    id: serial("id").primaryKey(),
    portionId: integer("portion_id")
      .notNull()
      .references(() => portions.id),
    name: text("name").notNull(),           // "A-Room1", "A-Room2", etc.
    capacity: smallint("capacity").notNull().default(2),  // max 2 girls per room
    singleRent: numeric("single_rent", { precision: 10, scale: 2 }), // Custom rent if single occupied
    isActive: boolean("is_active").notNull().default(true),  // false = room closed
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("rooms_portion_name_idx").on(t.portionId, t.name),
    check("rooms_capacity_check", sql`${t.capacity} BETWEEN 1 AND 2`),
  ]
);

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  portion: one(portions, {
    fields: [rooms.portionId],
    references: [portions.id],
  }),
  occupancies: many(roomOccupancies),
  meter: many(meters),
}));

// ─────────────────────────────────────────────────────────────
// RESIDENTS
// ─────────────────────────────────────────────────────────────
export const residents = pgTable("residents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  idType: text("id_type"),         // "aadhaar" | "pan" | "passport" | "other"
  idNumberEncrypted: text("id_number_encrypted"),  // AES-256 encrypted
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),  // false = moved out
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const residentsRelations = relations(residents, ({ many, one }) => ({
  occupancies: many(roomOccupancies),
  foodPreferences: many(foodPreferences),
  bills: many(monthlyBills),
  payments: many(payments),
  securityDeposit: one(securityDeposits),
}));

// ─────────────────────────────────────────────────────────────
// ROOM OCCUPANCIES  (history of who was in which room)
// ─────────────────────────────────────────────────────────────
export const roomOccupancies = pgTable(
  "room_occupancies",
  {
    id: serial("id").primaryKey(),
    residentId: integer("resident_id")
      .notNull()
      .references(() => residents.id),
    roomId: integer("room_id")
      .notNull()
      .references(() => rooms.id),
    customRent: numeric("custom_rent", { precision: 10, scale: 2 }), // Custom rent for this resident (e.g. single occupancy)
    moveInDate: date("move_in_date").notNull(),
    moveOutDate: date("move_out_date"),   // NULL = currently active
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("occupancies_room_idx").on(t.roomId),
    index("occupancies_resident_idx").on(t.residentId),
    // Note: Overlap prevention is enforced at application layer with a query
    // before insert (PostgreSQL EXCLUDE USING GIST requires btree_gist extension;
    // we handle this in the API route to avoid extension dependency).
  ]
);

export const roomOccupanciesRelations = relations(roomOccupancies, ({ one }) => ({
  resident: one(residents, {
    fields: [roomOccupancies.residentId],
    references: [residents.id],
  }),
  room: one(rooms, {
    fields: [roomOccupancies.roomId],
    references: [rooms.id],
  }),
}));

// ─────────────────────────────────────────────────────────────
// FOOD PREFERENCES  (per resident per billing cycle)
// cycle_start_date is always a 15th — enforced in application layer
// ─────────────────────────────────────────────────────────────
export const foodPreferences = pgTable(
  "food_preferences",
  {
    id: serial("id").primaryKey(),
    residentId: integer("resident_id")
      .notNull()
      .references(() => residents.id),
    cycleStartDate: date("cycle_start_date").notNull(), // always 15th
    hasFood: boolean("has_food").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("food_pref_resident_cycle_idx").on(t.residentId, t.cycleStartDate),
  ]
);

export const foodPreferencesRelations = relations(foodPreferences, ({ one }) => ({
  resident: one(residents, {
    fields: [foodPreferences.residentId],
    references: [residents.id],
  }),
}));

// ─────────────────────────────────────────────────────────────
// METERS  (12 total: 8 room meters + 4 kitchen meters)
// ─────────────────────────────────────────────────────────────
export const meters = pgTable(
  "meters",
  {
    id: serial("id").primaryKey(),
    meterCode: text("meter_code").notNull().unique(),  // e.g. "A-R1", "A-K"
    meterType: text("meter_type").notNull(),           // "room" | "kitchen"
    roomId: integer("room_id").references(() => rooms.id),        // set for room meters
    portionId: integer("portion_id").references(() => portions.id), // set for kitchen meters
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // meterType "room" must have roomId; "kitchen" must have portionId
    check(
      "meters_type_check",
      sql`(${t.meterType} = 'room' AND ${t.roomId} IS NOT NULL AND ${t.portionId} IS NULL)
       OR (${t.meterType} = 'kitchen' AND ${t.portionId} IS NOT NULL AND ${t.roomId} IS NULL)`
    ),
  ]
);

export const metersRelations = relations(meters, ({ one, many }) => ({
  room: one(rooms, {
    fields: [meters.roomId],
    references: [rooms.id],
  }),
  portion: one(portions, {
    fields: [meters.portionId],
    references: [portions.id],
  }),
  readings: many(meterReadings),
}));

// ─────────────────────────────────────────────────────────────
// METER READINGS  (append-only; one opening + one closing per cycle)
// cycle_start_date is always a 15th — enforced in application layer
// ─────────────────────────────────────────────────────────────
export const meterReadings = pgTable(
  "meter_readings",
  {
    id: serial("id").primaryKey(),
    meterId: integer("meter_id")
      .notNull()
      .references(() => meters.id),
    cycleStartDate: date("cycle_start_date").notNull(), // always 15th
    readingType: text("reading_type").notNull(),  // "opening" | "closing"
    readingValue: numeric("reading_value", { precision: 10, scale: 2 }).notNull(),
    readAt: date("read_at").notNull(),   // actual date reading was physically taken
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    recordedBy: text("recorded_by").notNull(),
    notes: text("notes"),
  },
  (t) => [
    uniqueIndex("readings_meter_cycle_type_idx").on(
      t.meterId,
      t.cycleStartDate,
      t.readingType
    ),
    check(
      "readings_type_check",
      sql`${t.readingType} IN ('opening', 'closing')`
    ),
    check(
      "readings_value_check",
      sql`${t.readingValue} >= 0`
    ),
  ]
);

export const meterReadingsRelations = relations(meterReadings, ({ one }) => ({
  meter: one(meters, {
    fields: [meterReadings.meterId],
    references: [meters.id],
  }),
}));

// ─────────────────────────────────────────────────────────────
// MONTHLY BILLS  (one per resident per billing cycle)
// Immutable once status = 'FINALIZED'
// ─────────────────────────────────────────────────────────────
export const monthlyBills = pgTable(
  "monthly_bills",
  {
    id: serial("id").primaryKey(),
    residentId: integer("resident_id")
      .notNull()
      .references(() => residents.id),

    // Billing cycle: e.g. 15-Oct-2026 → 15-Nov-2026
    cycleStartDate: date("cycle_start_date").notNull(),  // always 15th
    cycleEndDate: date("cycle_end_date").notNull(),      // always 15th of next month

    status: text("status").notNull().default("DRAFT"),
    // "DRAFT" → "FINALIZED" → cannot change; "VOID" for corrections

    // Fixed charges (captured at finalization)
    baseRent: numeric("base_rent", { precision: 10, scale: 2 }).notNull(),
    foodCharge: numeric("food_charge", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    hasFood: boolean("has_food").notNull(),

    // Electricity: sum of all meter shares for this resident
    electricityCharge: numeric("electricity_charge", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),

    // One-time manual adjustments
    otherCharges: numeric("other_charges", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    otherCredits: numeric("other_credits", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    otherNotes: text("other_notes"),

    // totalAmount = baseRent + foodCharge + electricityCharge + otherCharges - otherCredits
    // Stored as a real column (not GENERATED ALWAYS) for Drizzle compatibility.
    // Computed and written by the billing engine before insert.
    totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),

    // Frozen snapshot of all data used to produce this bill (for receipts)
    snapshot: jsonb("snapshot"),

    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("bills_resident_cycle_idx").on(t.residentId, t.cycleStartDate),
    check("bills_status_check", sql`${t.status} IN ('DRAFT', 'FINALIZED', 'VOID')`),
    check("bills_end_after_start", sql`${t.cycleEndDate} > ${t.cycleStartDate}`),
  ]
);

export const monthlyBillsRelations = relations(monthlyBills, ({ one, many }) => ({
  resident: one(residents, {
    fields: [monthlyBills.residentId],
    references: [residents.id],
  }),
  lineItems: many(billLineItems),
  payments: many(payments),
}));

// ─────────────────────────────────────────────────────────────
// BILL LINE ITEMS  (per-meter electricity breakdown per bill)
// ─────────────────────────────────────────────────────────────
export const billLineItems = pgTable(
  "bill_line_items",
  {
    id: serial("id").primaryKey(),
    billId: integer("bill_id")
      .notNull()
      .references(() => monthlyBills.id),
    meterId: integer("meter_id")
      .notNull()
      .references(() => meters.id),
    meterCode: text("meter_code").notNull(),       // denormalized for snapshot safety
    meterType: text("meter_type").notNull(),       // "room" | "kitchen"
    openingReading: numeric("opening_reading", { precision: 10, scale: 2 }).notNull(),
    closingReading: numeric("closing_reading", { precision: 10, scale: 2 }).notNull(),
    unitsConsumed: numeric("units_consumed", { precision: 10, scale: 2 }).notNull(),
    ratePerUnit: numeric("rate_per_unit", { precision: 8, scale: 4 }).notNull(),  // e.g. 10.0000
    totalMeterCost: numeric("total_meter_cost", { precision: 10, scale: 2 }).notNull(),
    eligibleResidents: smallint("eligible_residents").notNull(), // divisor used
    residentShare: numeric("resident_share", { precision: 10, scale: 2 }).notNull(),
  },
  (t) => [
    index("line_items_bill_idx").on(t.billId),
    check(
      "line_items_closing_gte_opening",
      sql`${t.closingReading} >= ${t.openingReading}`
    ),
  ]
);

export const billLineItemsRelations = relations(billLineItems, ({ one }) => ({
  bill: one(monthlyBills, {
    fields: [billLineItems.billId],
    references: [monthlyBills.id],
  }),
  meter: one(meters, {
    fields: [billLineItems.meterId],
    references: [meters.id],
  }),
}));

// ─────────────────────────────────────────────────────────────
// PAYMENTS  (never deleted; errors corrected via other_credits)
// ─────────────────────────────────────────────────────────────
export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    residentId: integer("resident_id")
      .notNull()
      .references(() => residents.id),
    billId: integer("bill_id").references(() => monthlyBills.id), // NULL = advance
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    paymentDate: date("payment_date").notNull(),
    paymentMode: text("payment_mode").notNull(),
    // "cash" | "upi" | "bank_transfer" | "cheque" | "other"
    reference: text("reference"),   // UPI txn ID, cheque no., etc.
    notes: text("notes"),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    recordedBy: text("recorded_by").notNull(),
  },
  (t) => [
    index("payments_resident_idx").on(t.residentId),
    index("payments_bill_idx").on(t.billId),
    check("payments_amount_check", sql`${t.amount} > 0`),
    check(
      "payments_mode_check",
      sql`${t.paymentMode} IN ('cash', 'upi', 'bank_transfer', 'cheque', 'other')`
    ),
  ]
);

export const paymentsRelations = relations(payments, ({ one }) => ({
  resident: one(residents, {
    fields: [payments.residentId],
    references: [residents.id],
  }),
  bill: one(monthlyBills, {
    fields: [payments.billId],
    references: [monthlyBills.id],
  }),
}));

// ─────────────────────────────────────────────────────────────
// SECURITY DEPOSITS  (one per resident; updated on refund)
// ─────────────────────────────────────────────────────────────
export const securityDeposits = pgTable(
  "security_deposits",
  {
    id: serial("id").primaryKey(),
    residentId: integer("resident_id")
      .notNull()
      .references(() => residents.id)
      .unique(),
    amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }).notNull(),
    paymentDate: date("payment_date").notNull(),
    paymentMode: text("payment_mode").notNull(),
    reference: text("reference"),
    // Refund tracking
    amountRefunded: numeric("amount_refunded", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    refundDate: date("refund_date"),
    refundMode: text("refund_mode"),
    refundReference: text("refund_reference"),
    refundNotes: text("refund_notes"),
    // "held" | "partially_refunded" | "fully_refunded"
    status: text("status").notNull().default("held"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "deposit_status_check",
      sql`${t.status} IN ('held', 'partially_refunded', 'fully_refunded')`
    ),
    check("deposit_amount_check", sql`${t.amountPaid} >= 0`),
    check("deposit_refunded_check", sql`${t.amountRefunded} >= 0`),
  ]
);

export const securityDepositsRelations = relations(securityDeposits, ({ one }) => ({
  resident: one(residents, {
    fields: [securityDeposits.residentId],
    references: [residents.id],
  }),
}));

// ─────────────────────────────────────────────────────────────
// AUDIT LOG  (append-only; no UPDATE/DELETE ever)
// ─────────────────────────────────────────────────────────────
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  tableName: text("table_name").notNull(),
  recordId: integer("record_id"),
  action: text("action").notNull(),
  // "INSERT" | "UPDATE" | "FINALIZE" | "VOID" | "LOGIN" | "CONFIG_CHANGE"
  actor: text("actor").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// EXPENSES  (PG Operational Expenses & P&L tracking)
// ─────────────────────────────────────────────────────────────
export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    category: text("category").notNull(),
    title: text("title").notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    expenseDate: date("expense_date").notNull(),
    paymentMode: text("payment_mode").notNull(),
    vendorName: text("vendor_name"),
    reference: text("reference"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("expenses_date_idx").on(t.expenseDate),
    index("expenses_category_idx").on(t.category),
    check("expenses_amount_check", sql`${t.amount} > 0`),
    check(
      "expenses_category_check",
      sql`${t.category} IN ('electricity_discom', 'wifi', 'water', 'cook_salary', 'groceries', 'repairs', 'cleaning', 'other')`
    ),
    check(
      "expenses_payment_mode_check",
      sql`${t.paymentMode} IN ('upi', 'cash', 'bank_transfer', 'cheque', 'other')`
    ),
  ]
);

// ─────────────────────────────────────────────────────────────
// TYPE EXPORTS  (for use in API routes and server components)
// ─────────────────────────────────────────────────────────────
export type Config = typeof config.$inferSelect;
export type Portion = typeof portions.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type Resident = typeof residents.$inferSelect;
export type RoomOccupancy = typeof roomOccupancies.$inferSelect;
export type FoodPreference = typeof foodPreferences.$inferSelect;
export type Meter = typeof meters.$inferSelect;
export type MeterReading = typeof meterReadings.$inferSelect;
export type MonthlyBill = typeof monthlyBills.$inferSelect;
export type BillLineItem = typeof billLineItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type SecurityDeposit = typeof securityDeposits.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;

export type NewResident = typeof residents.$inferInsert;
export type NewRoomOccupancy = typeof roomOccupancies.$inferInsert;
export type NewMeterReading = typeof meterReadings.$inferInsert;
export type NewMonthlyBill = typeof monthlyBills.$inferInsert;
export type NewBillLineItem = typeof billLineItems.$inferInsert;
export type NewPayment = typeof payments.$inferInsert;
export type NewExpense = typeof expenses.$inferInsert;

