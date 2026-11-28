import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { type Moyen, MOYENS } from "@/lib/montants";

export type Totaux = Record<Moyen, number> & { total: number; ventes: number };
const vide = (): Totaux => ({ especes: 0, cb: 0, en_ligne: 0, total: 0, ventes: 0 });

/** Totaux par concours (et par moyen de paiement). */
export async function totauxParConcours(): Promise<Map<number, Totaux>> {
  const lignes = await db.select({ id: schema.vente.concoursId, moyen: schema.vente.moyen,
    somme: sql<number>`sum(${schema.vente.centimes})::int`, n: sql<number>`count(*)::int` })
    .from(schema.vente).groupBy(schema.vente.concoursId, schema.vente.moyen);
  const m = new Map<number, Totaux>();
  for (const l of lignes) {
    const t = m.get(l.id) ?? vide();
    if (l.moyen in MOYENS) t[l.moyen as Moyen] += l.somme;
    t.total += l.somme; t.ventes += l.n;
    m.set(l.id, t);
  }
  return m;
}

export const listeConcours = () => db.select().from(schema.concours).orderBy(desc(schema.concours.debut), desc(schema.concours.id));

export async function unConcours(id: number) {
  const [c] = await db.select().from(schema.concours).where(eq(schema.concours.id, id));
  if (!c) return null;
  const ventes = await db.select().from(schema.vente).where(eq(schema.vente.concoursId, id)).orderBy(desc(schema.vente.t), desc(schema.vente.id));
  const t = vide();
  const parJour = new Map<string, Totaux>();
  for (const v of ventes) {
    const jour = v.t.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
    const j = parJour.get(jour) ?? vide();
    for (const x of [t, j]) { if (v.moyen in MOYENS) x[v.moyen as Moyen] += v.centimes; x.total += v.centimes; x.ventes++; }
    parJour.set(jour, j);
  }
  return { c, ventes, totaux: t, parJour: [...parJour.entries()].sort((a, b) => a[0].localeCompare(b[0])) };
}

export async function ajouterVente(v: { concoursId: number; moyen: Moyen; centimes: number; libelle?: string; ref?: string | null; saisiPar?: string | null }) {
  const [r] = await db.insert(schema.vente).values({ concoursId: v.concoursId, moyen: v.moyen, centimes: v.centimes,
    libelle: (v.libelle ?? "").slice(0, 120), ref: v.ref ?? null, saisiPar: v.saisiPar ?? null })
    .onConflictDoNothing({ target: schema.vente.ref }).returning({ id: schema.vente.id });
  return r?.id ?? null; // null : référence déjà enregistrée
}

export async function supprimerVente(concoursId: number, id: number) {
  const r = await db.delete(schema.vente).where(and(eq(schema.vente.id, id), eq(schema.vente.concoursId, concoursId))).returning();
  return r[0] ?? null;
}

/** CA par mois (AAAA-MM, heure de Paris) et par moyen, pour une année. */
export async function parMois(annee: number) {
  const mois = sql<string>`to_char(${schema.vente.t} at time zone 'Europe/Paris', 'YYYY-MM')`;
  const lignes = await db.select({ mois, moyen: schema.vente.moyen, somme: sql<number>`sum(${schema.vente.centimes})::int` })
    .from(schema.vente).where(sql`extract(year from ${schema.vente.t} at time zone 'Europe/Paris') = ${annee}`)
    .groupBy(mois, schema.vente.moyen);
  const m = new Map<string, Totaux>();
  for (const l of lignes) {
    const t = m.get(l.mois) ?? vide();
    if (l.moyen in MOYENS) t[l.moyen as Moyen] += l.somme;
    t.total += l.somme;
    m.set(l.mois, t);
  }
  return m;
}
