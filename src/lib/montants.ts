// Montants et dates du module Concours (sans base de données : testable seul).
export const MOYENS = { especes: "Espèces", cb: "CB", en_ligne: "En ligne" } as const;
export type Moyen = keyof typeof MOYENS;
export const estMoyen = (m: string): m is Moyen => m in MOYENS;

/** « 12 », « 12,5 », « 1 234,50 €», « -20 » → centimes. null si illisible ou hors bornes (±100 000 €). */
export function centimes(saisie: string): number | null {
  const s = saisie.replace(/[\s €]/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  const c = Math.round(parseFloat(s) * 100);
  return c === 0 || Math.abs(c) > 10_000_000 ? null : c;
}

const FORMAT = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
export const euros = (c: number) => FORMAT.format(c / 100);

/** Date du jour à Paris, AAAA-MM-JJ. */
export function aujourdhui(maintenant = new Date()): string {
  return maintenant.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
}

export type Etat = "a_venir" | "en_cours" | "termine";
export const ETATS: Record<Etat, string> = { a_venir: "À venir", en_cours: "En cours", termine: "Terminé" };
export function etat(debut: string, fin: string, jour = aujourdhui()): Etat {
  return jour < debut ? "a_venir" : jour > fin ? "termine" : "en_cours";
}

export const estDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d + "T00:00:00Z"));
