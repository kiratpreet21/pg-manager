/**
 * Billing cycle utilities for the 1st-to-1st monthly billing cycle.
 *
 * Rules:
 *   - Cycle start: always the 1st of a month (e.g. 2026-10-01)
 *   - Cycle end:   always the 1st of the next month (e.g. 2026-11-01)
 *   - Display: "1 Oct 2026 – 1 Nov 2026"
 */

import { format, addMonths, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export const IST = "Asia/Kolkata";

/**
 * Get the current billing cycle start date (1st of this month).
 */
export function getCurrentCycleStart(): Date {
  const now = toZonedTime(new Date(), IST);
  const year = now.getFullYear();
  const month = now.getMonth();
  return new Date(year, month, 1);
}

/**
 * Given a cycle start date (1st), return the cycle end date (1st of next month).
 */
export function getCycleEnd(cycleStart: Date): Date {
  return addMonths(cycleStart, 1);
}

/**
 * Format a billing cycle for display.
 * e.g. "1 Oct 2026 – 1 Nov 2026"
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
 * Given a cycle_start_date string (YYYY-MM-01 or legacy YYYY-MM-15), validate it is a valid cycle start date.
 */
export function isCycleStartDate(dateStr: string): boolean {
  try {
    const d = parseISO(dateStr);
    return !isNaN(d.getTime()) && (d.getDate() === 1 || d.getDate() === 15);
  } catch {
    return false;
  }
}

/**
 * Generate the cycle_start_date string for a given month and year.
 * e.g. getCycleStartString(2026, 10) → "2026-10-01"
 */
export function getCycleStartString(year: number, month: number): string {
  // month is 1-indexed (1 = January)
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/**
 * Get the cycle_end_date string from a cycle_start_date string.
 * e.g. "2026-10-01" → "2026-11-01"
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
    const start = new Date(currentStart.getFullYear(), currentStart.getMonth() - i, 1);
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
