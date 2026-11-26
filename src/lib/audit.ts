import { db, schema } from "@/db";
import { desc } from "drizzle-orm";

export type Evenement = {
  userId?: string | null;
  email?: string | null;
  action: string;
  cible?: string | null;
  details?: Record<string, unknown> | null;
  ip?: string | null;
};

/** Ajoute une ligne au journal. Ne bloque jamais l'action en cas d'erreur d'écriture : l'erreur est affichée en console. */
export async function noter(e: Evenement): Promise<void> {
  try {
    await db.insert(schema.audit).values({
      userId: e.userId ?? null, email: e.email ?? null, action: e.action.slice(0, 80),
      cible: e.cible?.slice(0, 200) ?? null, details: e.details ?? null, ip: e.ip?.slice(0, 64) ?? null,
    });
  } catch (err) {
    console.error("journal d'audit :", err);
  }
}

export async function derniers(n = 200) {
  return db.select().from(schema.audit).orderBy(desc(schema.audit.t)).limit(Math.min(1000, n));
}

/** Adresse IP réelle : posée par Caddy (X-Real-IP), qui retire les en-têtes envoyés par le visiteur. */
export function ipDe(h: Headers): string | null {
  return h.get("x-real-ip");
}
