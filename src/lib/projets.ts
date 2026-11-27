import "server-only";
import { db, schema } from "@/db";
import { chiffrerJson, dechiffrerJson } from "@/lib/chiffrement";

export const STATUTS = { en_cours: "En cours", en_pause: "En pause", idee: "Idée", livre: "Livré / en service", abandonne: "Abandonné" } as const;
export const PRIORITES = { haute: "Haute", normale: "Normale", basse: "Basse" } as const;
export type Statut = keyof typeof STATUTS;
export type Priorite = keyof typeof PRIORITES;
export type Suivi = { statut: Statut; priorite: Priorite; masque: boolean; prochaine: string; note: string; maj: number | null };

export const SUIVI_VIDE: Suivi = { statut: "en_cours", priorite: "normale", masque: false, prochaine: "", note: "", maj: null };

export async function suivis(): Promise<Map<string, Suivi>> {
  const lignes = await db.select().from(schema.projet);
  return new Map(lignes.map((l) => {
    let c = { prochaine: "", note: "" };
    try { if (l.contenuC) c = { ...c, ...dechiffrerJson<typeof c>(l.contenuC) }; } catch { /* clé changée : texte illisible */ }
    return [l.depot, { statut: (l.statut in STATUTS ? l.statut : "en_cours") as Statut, priorite: (l.priorite in PRIORITES ? l.priorite : "normale") as Priorite,
                       masque: l.masque, prochaine: c.prochaine, note: c.note, maj: l.maj.getTime() }];
  }));
}

export async function enregistrer(depot: string, s: Omit<Suivi, "maj">, par: string) {
  const v = { statut: s.statut, priorite: s.priorite, masque: s.masque, contenuC: chiffrerJson({ prochaine: s.prochaine, note: s.note }), maj: new Date(), majPar: par };
  await db.insert(schema.projet).values({ depot, ...v }).onConflictDoUpdate({ target: schema.projet.depot, set: v });
}
