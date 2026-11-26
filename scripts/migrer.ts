// Applique les migrations SQL de drizzle/ (au démarrage du conteneur et en local).
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL ?? "", { max: 1 });
await migrate(drizzle(sql), { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
await sql.end();
console.log("Base à jour.");
