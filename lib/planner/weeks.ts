import type { PlanningWeek } from "./types";

/** Today's date ("YYYY-MM-DD") in Eastern time - the timezone NHL game dates and platform lock times use. */
export function todayEastern(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

/** Inclusive list of "YYYY-MM-DD" dates from start to end. */
export function datesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const d = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  while (d <= end) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

/**
 * The week to plan by default: the next one that hasn't started yet. Once the season's
 * last week has started there's nothing ahead, so fall back to the last week.
 */
export function pickNextWeek<T extends Pick<PlanningWeek, "startDate">>(weeks: readonly T[], today: string): T | undefined {
  return weeks.find((w) => w.startDate > today) ?? weeks[weeks.length - 1];
}

export interface PickupHorizon {
  /** The displayed week's days that haven't passed yet (today included). Empty for a past week. */
  thisWeek: { number: number; days: string[] };
  /** The whole week after the displayed one, if the season has one. */
  nextWeek: { number: number; days: string[] } | null;
}

/**
 * The days pickups are scored over for the displayed week: its remaining days (all of them
 * for a future week, Thu-Sun if viewed on a Thursday), plus the whole following week.
 */
export function pickupHorizon(weeks: readonly PlanningWeek[], week: PlanningWeek, today: string): PickupHorizon {
  const next = weeks[weeks.findIndex((w) => w.number === week.number) + 1];
  return {
    thisWeek: { number: week.number, days: week.days.filter((d) => d >= today) },
    nextWeek: next ? { number: next.number, days: next.days } : null,
  };
}

/** The displayed week's days plus the following week's, sorted and deduplicated. */
export function daysToLoad(week: PlanningWeek, horizon: PickupHorizon): string[] {
  return [...new Set([...week.days, ...(horizon.nextWeek?.days ?? [])])].sort();
}
