import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Drizzle Kit drives schema introspection, migration generation, and studio.
// `db:push` applies the current schema.ts to the DATABASE_URL directly —
// convenient for scaffolding; move to generated migrations before prod use.

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
