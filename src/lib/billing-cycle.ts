/**
 * Billing cycle utilities for the 15th-to-15th billing cycle.
 *
 * Confirmed rules:
 *   - Cycle start: always the 15th of a month
 *   - Cycle end:   always the 15th of the next month (both inclusive)
 *   - Display: "15 Oct 2026 – 15 Nov 2026"
 */

import { format, addMonths, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export const IST = "Asia/Kolkata";

/**
 * Get the current billing cycle start date (15th of this or last month).
 * If today is before the 15th, the current cycle started on the 15th of last month.
 * If today is on/after the 15th, the current cycle started on the 15th of this month.
 */
export function getCurrentCycleStart(): Date {
  const now = toZonedTime(new Date(), IST);
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  if (day >= 15) {
    return new Date(year, month, 15);
  } else {
    // Before the 15th — cycle started on the 15th of last month
    const lastMonth = new Date(year, month - 1, 15);
    return lastMonth;
  }
}

/**
 * Given a cycle start date (15th), return the cycle end date (15th of next month).
 */
export function getCycleEnd(cycleStart: Date): Date {
  return addMonths(cycleStart, 1);
}

/**
 * Format a billing cycle for display.
 * e.g. "15 Oct 2026 – 15 Nov 2026"
 */
export function formatCycle(cycleStartDate: string | Date): string {
  const start =
    typeof cycleStartDate === "string"
      ? parseISO(cycleStartDate)
      : cycleStartDate;
  const end = getCycleEnd(start);
  return `${format(start, "d MMM yyyy")} – ${format(end, "d MMM yyyy")}`;
}

/**
 * Format a date in Indian format: DD/MM/YYYY
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd/MM/yyyy");
}

/**
 * Given a cycle_start_date string (YYYY-MM-15), validate it is actually the 15th.
 */
export function isCycleStartDate(dateStr: string): boolean {
  try {
    const d = parseISO(dateStr);
    return d.getDate() === 15;
  } catch {
    return false;
  }
}

/**
 * Generate the cycle_start_date string for a given month and year.
 * e.g. getCycleStartString(2026, 10) → "2026-10-15"
 */
export function getCycleStartString(year: number, month: number): string {
  // month is 1-indexed (1 = January)
  return `${year}-${String(month).padStart(2, "0")}-15`;
}

/**
 * Get the cycle_end_date string from a cycle_start_date string.
 * e.g. "2026-10-15" → "2026-11-15"
 */
export function getCycleEndString(cycleStartStr: string): string {
  const start = parseISO(cycleStartStr);
  const end = addMonths(start, 1);
  return format(end, "yyyy-MM-dd");
}

/**
 * List recent billing cycles (last N cycles) for dropdown menus.
 */
export function getRecentCycles(count: number = 6): Array<{
  label: string;
  cycleStartDate: string;
  cycleEndDate: string;
}> {
  const cycles = [];
  const currentStart = getCurrentCycleStart();

  for (let i = 0; i < count; i++) {
    const start = new Date(currentStart);
    start.setMonth(start.getMonth() - i);
    const end = getCycleEnd(start);
    const startStr = format(start, "yyyy-MM-dd");
    const endStr = format(end, "yyyy-MM-dd");
    cycles.push({
      label: `${format(start, "d MMM yyyy")} – ${format(end, "d MMM yyyy")}`,
      cycleStartDate: startStr,
      cycleEndDate: endStr,
    });
  }

  return cycles;
}
