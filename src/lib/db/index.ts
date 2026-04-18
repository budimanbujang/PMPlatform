// =============================================================================
// Postgres connection + Drizzle query client.
// Uses postgres.js (driver) + drizzle-orm (query builder).
//
// Azure Database for PostgreSQL Flexible Server enforces SSL. We set
// `ssl: "require"` and rely on Azure's managed certificate chain — no need
// to bundle DigiCertGlobalRootCA unless your firewall strips it.
//
// Singleton pattern prevents Next.js HMR from opening a new pool on every
// reload in dev.
// =============================================================================

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __pmoPg: ReturnType<typeof postgres> | undefined;
}

function makeClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — cannot connect to Azure Postgres");
  }

  // Azure Flexible Server listens on 5432 with SSL required. postgres.js
  // accepts "require" as shorthand; no cert bundling needed in most cases.
  // `max: 10` keeps connection count sane for App Service B1 (each node
  // instance uses its own pool).
  return postgres(url, {
    ssl: "require",
    max: 10,
    idle_timeout: 20,
    connect_timeout: 15,
    // Keep bigint as strings (numeric in audit_log.id) to avoid precision
    // loss on round-trips.
    transform: { undefined: null },
  });
}

const pg = globalThis.__pmoPg ?? makeClient();
if (process.env.NODE_ENV !== "production") globalThis.__pmoPg = pg;

// Drizzle — typed query builder, use for mutations + joins.
export const db = drizzle(pg, { schema, logger: false });
export { schema };
export type DB = typeof db;

// Raw postgres.js tagged template — use for SELECTs where we want
// snake_case rows matching the legacy Supabase response shape, so
// existing server components don't need to change their property
// accesses.  Example: `const rows = await sql\`SELECT id, organisation_id FROM projects\``.
export const sql = pg;
