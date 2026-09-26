import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// `generate` only diffs against local migration snapshots and doesn't need a live
// connection, so don't hard-fail here - `migrate`/`push`/`studio` will fail on their
// own with a clearer error if DATABASE_URL really is missing when they need it.
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://placeholder",
  },
});
