import ExcelJS from "exceljs";
import { normalizeSpreadsheetTeamAbbrev } from "@/lib/nhl/team-abbrev";

const SHEET_NAME = "The List";

// Column layout of "The List" tab, verified against the 2026-27 projections file.
// Fixed indices rather than name lookup because the sheet has duplicate headers
// (skater GP vs. goalie GP) and blank spacer columns.
const COL = {
  RANK: 0,
  NAME: 1,
  KEEP_FLAG: 2,
  POSITION: 3,
  TEAM: 5,
  AGE: 6,
  SALARY: 7,
  FANTASY_POINTS: 8,
  FANTASY_POINTS_PER_GP: 9,
  VORP: 10,
  ADP: 12,
} as const;

// Everything else (skater and goalie counting stats) gets swept into `stats` by header label.
const STATS_COLUMNS: Array<{ index: number; label: string }> = [
  { index: 16, label: "GP" },
  { index: 17, label: "TOI" },
  { index: 18, label: "G" },
  { index: 19, label: "A" },
  { index: 20, label: "PTS" },
  { index: 21, label: "SOG" },
  { index: 22, label: "PPG" },
  { index: 23, label: "PPP" },
  { index: 24, label: "SHG" },
  { index: 25, label: "SHP" },
  { index: 26, label: "BLK" },
  { index: 27, label: "HIT" },
  { index: 28, label: "PLUS_MINUS" },
  { index: 29, label: "PIM" },
  { index: 30, label: "GWG" },
  { index: 31, label: "FOW" },
  { index: 32, label: "FOL" },
  { index: 33, label: "FO_PCT" },
  { index: 35, label: "GOALIE_GP" },
  { index: 36, label: "W" },
  { index: 37, label: "L" },
  { index: 38, label: "OTL" },
  { index: 39, label: "SO" },
  { index: 40, label: "SV" },
  { index: 41, label: "GA" },
  { index: 42, label: "SV_PCT" },
  { index: 43, label: "GAA" },
];

export interface ParsedProjectionRow {
  rank: number | null;
  name: string;
  keepFlag: string | null; // raw "KEEP?" column value - informational only, NOT the source of truth for keepers
  position: string | null;
  nhlTeamAbbrev: string | null;
  age: number | null;
  salary: number | null;
  fantasyPoints: number | null;
  fantasyPointsPerGp: number | null;
  vorp: number | null;
  adp: number | null;
  stats: Record<string, number | null>;
}

/** Unwraps ExcelJS's { formula, result } shape for formula cells; passes everything else through. */
function unwrapFormula(value: ExcelJS.CellValue): ExcelJS.CellValue {
  if (value !== null && typeof value === "object" && "result" in value) {
    return (value as ExcelJS.CellFormulaValue).result ?? null;
  }
  return value;
}

function cellNumber(value: ExcelJS.CellValue): number | null {
  const v = unwrapFormula(value);
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function cellString(value: ExcelJS.CellValue): string | null {
  const v = unwrapFormula(value);
  if (v === null || v === undefined) return null;
  const str = String(v).trim();
  return str === "" ? null : str;
}

/** Parses the "The List" tab of the Fantrax projections spreadsheet into row objects. */
export async function parseProjectionsSpreadsheet(input: Buffer | string): Promise<ParsedProjectionRow[]> {
  const workbook = new ExcelJS.Workbook();
  if (typeof input === "string") {
    await workbook.xlsx.readFile(input);
  } else {
    // exceljs's Buffer type predates @types/node's generic Buffer<TArrayBuffer> - same
    // runtime type, just a type-checker mismatch between the two.
    await workbook.xlsx.load(input as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  }

  const sheet = workbook.getWorksheet(SHEET_NAME);
  if (!sheet) {
    throw new Error(`Expected a "${SHEET_NAME}" tab in the workbook, found: ${workbook.worksheets.map((s) => s.name).join(", ")}`);
  }

  const headerRow = sheet.getRow(1);
  const rankHeader = cellString(headerRow.getCell(COL.RANK + 1).value);
  const nameHeader = cellString(headerRow.getCell(COL.NAME + 1).value);
  if (rankHeader?.toUpperCase() !== "RK" || nameHeader?.toUpperCase() !== "NAME") {
    throw new Error(
      `"${SHEET_NAME}" tab layout looks different than expected (header row was "${rankHeader}", "${nameHeader}"). ` +
        `Column indices in lib/import/spreadsheet.ts may need updating.`
    );
  }

  const rows: ParsedProjectionRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const name = cellString(row.getCell(COL.NAME + 1).value);
    if (!name) return; // skip blank trailing rows

    const stats: Record<string, number | null> = {};
    for (const { index, label } of STATS_COLUMNS) {
      stats[label] = cellNumber(row.getCell(index + 1).value);
    }

    rows.push({
      rank: cellNumber(row.getCell(COL.RANK + 1).value),
      name,
      keepFlag: cellString(row.getCell(COL.KEEP_FLAG + 1).value),
      position: cellString(row.getCell(COL.POSITION + 1).value),
      nhlTeamAbbrev: normalizeSpreadsheetTeamAbbrev(cellString(row.getCell(COL.TEAM + 1).value)),
      age: cellNumber(row.getCell(COL.AGE + 1).value),
      salary: cellNumber(row.getCell(COL.SALARY + 1).value),
      fantasyPoints: cellNumber(row.getCell(COL.FANTASY_POINTS + 1).value),
      fantasyPointsPerGp: cellNumber(row.getCell(COL.FANTASY_POINTS_PER_GP + 1).value),
      vorp: cellNumber(row.getCell(COL.VORP + 1).value),
      adp: cellNumber(row.getCell(COL.ADP + 1).value),
      stats,
    });
  });

  return rows;
}
