// Fallback for `drizzle-kit migrate`, which exits silently (code 1, no error message)
// against this Neon project as of 2026-09 - likely a websocket-driver quirk with the
// HTTP driver in Node. Applies every not-yet-applied drizzle/*.sql file directly via
// the same neon-http driver the app uses, splitting on drizzle's statement-breakpoint
// markers. Tracks applied files in a plain `_migrations_applied` table (NOT drizzle-kit's
// own bookkeeping format) so this script is idempotent across runs.
import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "node:fs";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS "_migrations_applied" (
    "filename" text PRIMARY KEY,
    "applied_at" timestamp DEFAULT now()
  )
`;

const applied = new Set((await sql`SELECT filename FROM "_migrations_applied"`).map((r) => r.filename));

const files = readdirSync("./drizzle")
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  if (applied.has(file)) {
    console.log("skip (already applied):", file);
    continue;
  }
  const contents = readFileSync(`./drizzle/${file}`, "utf8");
  const statements = contents
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await sql.query(statement);
  }
  await sql`INSERT INTO "_migrations_applied" (filename) VALUES (${file})`;
  console.log("applied:", file);
}

console.log("done");
