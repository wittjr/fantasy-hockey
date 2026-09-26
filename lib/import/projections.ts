import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { spreadsheetProjections } from "@/lib/db/schema";
import type { ParsedProjectionRow } from "./spreadsheet";

const INSERT_BATCH_SIZE = 200;

/** Replaces a user's entire projections import (simplest correct behavior for a full re-upload). */
export async function importSpreadsheetForUser(userId: string, rows: ParsedProjectionRow[]): Promise<void> {
  await db.delete(spreadsheetProjections).where(eq(spreadsheetProjections.userId, userId));
  if (rows.length === 0) return;

  const values = rows.map((row) => ({
    userId,
    rank: row.rank,
    name: row.name,
    position: row.position,
    nhlTeamAbbrev: row.nhlTeamAbbrev,
    age: row.age,
    salary: row.salary,
    fantasyPoints: row.fantasyPoints,
    fantasyPointsPerGp: row.fantasyPointsPerGp,
    vorp: row.vorp,
    adp: row.adp,
    stats: row.stats,
  }));

  // Batched (not one giant insert) to keep each request comfortably within size limits.
  for (let i = 0; i < values.length; i += INSERT_BATCH_SIZE) {
    await db.insert(spreadsheetProjections).values(values.slice(i, i + INSERT_BATCH_SIZE));
  }
}

export async function hasProjectionsImported(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: spreadsheetProjections.id })
    .from(spreadsheetProjections)
    .where(eq(spreadsheetProjections.userId, userId))
    .limit(1);
  return rows.length > 0;
}

export async function getProjectionsForUser(userId: string) {
  return db
    .select()
    .from(spreadsheetProjections)
    .where(eq(spreadsheetProjections.userId, userId))
    .orderBy(desc(spreadsheetProjections.fantasyPoints));
}
