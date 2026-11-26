import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globale = globalThis as unknown as { _sql?: ReturnType<typeof postgres> };
const url = process.env.DATABASE_URL;
if (!url && process.env.NEXT_PHASE !== "phase-production-build") {
  console.warn("DATABASE_URL absent");
}
export const sql = globale._sql ?? postgres(url ?? "postgres://localhost/hmpro", { max: 10, idle_timeout: 30 });
if (process.env.NODE_ENV !== "production") globale._sql = sql;
export const db = drizzle(sql, { schema });
export { schema };
