import type { FantraxPeriod } from "./client";
import type { PlanningWeek } from "@/lib/planner/types";
import { datesBetween } from "@/lib/planner/weeks";

/** The Eastern calendar date a Fantrax timestamp falls on - it's already Eastern, so just the prefix. */
export function fantraxDate(ts: string): string {
  return ts.slice(0, 10);
}

function dayBefore(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * A scoring period's lineup days: its start date up to the day before the next period
 * starts. Fantrax ends each period just before that day's first puck drop (e.g. period 1
 * ends "10-05T18:59"), and the 10-05 games belong to period 2.
 */
export function toPlanningWeek(period: FantraxPeriod): PlanningWeek {
  const days = datesBetween(fantraxDate(period.startDate), dayBefore(fantraxDate(period.endDate)));
  return { number: period.number, startDate: days[0], endDate: days[days.length - 1], days };
}
