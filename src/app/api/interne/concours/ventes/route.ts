import { and, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { jetonInterneOk, refus } from "@/lib/interne";
import { ajouterVente } from "@/lib/concours";
import { centimes, estDate, estMoyen } from "@/lib/montants";

export const dynamic = "force-dynamic";

/** Pour n8n (ventes des galeries en ligne) : { concours: id | date: "AAAA-MM-JJ", montant: "12,50", moyen?: "en_ligne",
 *  libelle?: "...", ref: "id unique côté galerie" }. Une même ref n'est jamais comptée deux fois. */
export async function POST(req: Request) {
  if (!(await jetonInterneOk(req))) return refus();
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return Response.json({ erreur: "JSON attendu" }, { status: 400 });
  const ref = String(b.ref ?? "").trim();
  const moyen = String(b.moyen ?? "en_ligne");
  const m = centimes(String(b.montant ?? ""));
  if (!/^[\w.:@-]{1,120}$/.test(ref)) return Response.json({ erreur: "ref obligatoire (1 à 120 caractères simples)" }, { status: 400 });
  if (!estMoyen(moyen) || m === null) return Response.json({ erreur: "moyen ou montant invalide" }, { status: 400 });
  let id = Number(b.concours);
  if (!Number.isInteger(id) || id <= 0) {
    const d = String(b.date ?? "");
    if (!estDate(d)) return Response.json({ erreur: "concours (id) ou date (AAAA-MM-JJ) obligatoire" }, { status: 400 });
    const l = await db.select({ id: schema.concours.id }).from(schema.concours).where(and(lte(schema.concours.debut, d), gte(schema.concours.fin, d)));
    if (l.length !== 1) return Response.json({ erreur: l.length ? "plusieurs concours ce jour-là : préciser concours" : "aucun concours ce jour-là" }, { status: 404 });
    id = l[0].id;
  } else {
    const [c] = await db.select({ id: schema.concours.id }).from(schema.concours).where(eq(schema.concours.id, id));
    if (!c) return Response.json({ erreur: "concours inconnu" }, { status: 404 });
  }
  const n = await ajouterVente({ concoursId: id, moyen, centimes: m, libelle: String(b.libelle ?? ""), ref: "auto:" + ref });
  return Response.json({ ok: true, concours: id, nouvelle: n !== null });
}
