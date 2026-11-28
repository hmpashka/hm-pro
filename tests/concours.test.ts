// Concours & CA contre PostgreSQL : totaux par moyen et par mois, remboursement, entrée n8n sans doublon.
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe.skipIf(!process.env.DATABASE_URL)("concours et chiffre d'affaires", async () => {
  const { db, schema, sql } = await import("@/db");
  const { ajouterVente, parMois, supprimerVente, totauxParConcours, unConcours } = await import("@/lib/concours");
  const { POST } = await import("@/app/api/interne/concours/ventes/route");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  let a = 0, b = 0;
  const n8n = (corps: unknown, jeton = process.env.N8N_JETON) => POST(new Request("http://x/api/interne/concours/ventes",
    { method: "POST", headers: { authorization: "Bearer " + jeton, "content-type": "application/json" }, body: JSON.stringify(corps) }));

  beforeAll(async () => {
    await sql.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    await migrate(drizzle(sql), { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
    [{ id: a }, { id: b }] = await db.insert(schema.concours).values([
      { nom: "CSO Fontainebleau", debut: "2026-05-02", fin: "2026-05-03", objectifCentimes: 200000 },
      { nom: "Pro Elite Lamotte", debut: "2026-06-10", fin: "2026-06-10" },
    ]).returning({ id: schema.concours.id });
  });
  afterAll(async () => { await sql.end(); });

  it("totaux par moyen, par jour, remboursement et suppression", async () => {
    const t = (j: string) => new Date(j);
    await db.insert(schema.vente).values([
      { concoursId: a, moyen: "especes", centimes: 2500, t: t("2026-05-02T10:00:00Z") },
      { concoursId: a, moyen: "cb", centimes: 4000, t: t("2026-05-02T15:00:00Z") },
      { concoursId: a, moyen: "cb", centimes: -1000, t: t("2026-05-03T09:00:00Z"), libelle: "remboursement" },
      { concoursId: b, moyen: "en_ligne", centimes: 9900, t: t("2026-06-12T09:00:00Z") },
    ]);
    const d = (await unConcours(a))!;
    expect(d.totaux).toMatchObject({ especes: 2500, cb: 3000, en_ligne: 0, total: 5500, ventes: 3 });
    expect(d.parJour.map(([j, x]) => [j, x.total])).toEqual([["2026-05-02", 6500], ["2026-05-03", -1000]]);
    expect((await totauxParConcours()).get(b)?.total).toBe(9900);
    const m = await parMois(2026);
    expect([m.get("2026-05")?.total, m.get("2026-06")?.en_ligne]).toEqual([5500, 9900]);
    expect(await supprimerVente(b, d.ventes[0].id)).toBeNull(); // pas une vente de ce concours
    expect(await supprimerVente(a, d.ventes[0].id)).not.toBeNull();
  });

  it("entrée n8n : jeton, concours retrouvé par date, jamais deux fois la même vente", async () => {
    expect((await n8n({ date: "2026-06-10", montant: "15", ref: "x" }, "faux".repeat(10))).status).toBe(401);
    let r = await n8n({ date: "2026-06-10", montant: "15,90", ref: "galerie-123", libelle: "Photo HD" });
    expect(await r.json()).toEqual({ ok: true, concours: b, nouvelle: true });
    r = await n8n({ date: "2026-06-10", montant: "15,90", ref: "galerie-123" });
    expect(await r.json()).toMatchObject({ nouvelle: false });
    expect((await n8n({ date: "2026-01-01", montant: "5", ref: "y" })).status).toBe(404);
    expect((await n8n({ concours: a, montant: "abc", ref: "z" })).status).toBe(400);
    expect((await n8n({ concours: a, montant: "5" })).status).toBe(400);
    expect((await totauxParConcours()).get(b)?.en_ligne).toBe(9900 + 1590);
    // une saisie manuelle sans ref n'entre jamais en conflit
    expect(await ajouterVente({ concoursId: b, moyen: "cb", centimes: 100 })).not.toBeNull();
    expect(await ajouterVente({ concoursId: b, moyen: "cb", centimes: 100 })).not.toBeNull();
  });

  it("supprimer un concours supprime ses ventes", async () => {
    const { eq } = await import("drizzle-orm");
    await db.delete(schema.concours).where(eq(schema.concours.id, b));
    expect((await totauxParConcours()).get(b)).toBeUndefined();
  });
});
