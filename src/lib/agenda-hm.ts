import "server-only";
import { and, gte, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { type Evenement, evenements, jourParis } from "@/lib/agenda";
import { peut, type Droits, type Personne } from "@/lib/droits";

/** Agenda Google + concours de HM Pro (si la personne a accès à l'onglet Concours). */
export async function agendaComplet(p: Personne, droits: Droits, debut: number, fin: number) {
  const r = await evenements(debut, fin);
  if (peut(p, droits, "concours", "lecture")) {
    const lignes = await db.select().from(schema.concours)
      .where(and(lte(schema.concours.debut, jourParis(fin)), gte(schema.concours.fin, jourParis(debut))));
    for (const c of lignes) {
      const a = Date.parse(c.debut + "T00:00:00Z");
      r.evenements.push({ id: "concours-" + c.id, titre: c.nom, debut: a, fin: Date.parse(c.fin + "T00:00:00Z") + 86400_000, journee: true,
        lieu: c.lieu, agenda: "Concours", n: -1, lien: "/concours/" + c.id } satisfies Evenement);
    }
    r.evenements.sort((x, y) => jourParis(x.debut).localeCompare(jourParis(y.debut)) || Number(y.journee) - Number(x.journee) || x.debut - y.debut);
  }
  return r;
}

/** Jours (AAAA-MM-JJ) couverts par un événement, pour l'afficher chaque jour. */
export function joursDe(e: Evenement): string[] {
  const j: string[] = [];
  const jour = (x: number) => e.journee ? new Date(x).toISOString().slice(0, 10) : jourParis(x); // journée entière : dates UTC
  const dernier = jour(e.journee ? e.fin - 1 : Math.max(e.debut, e.fin - 1));
  for (let d = jour(e.debut), i = 0; d <= dernier && i < 62; i++) {
    j.push(d);
    const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + 1); d = t.toISOString().slice(0, 10);
  }
  return j;
}
