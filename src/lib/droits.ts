// Modules (onglets) et niveaux d'accès. Contrôlé côté serveur sur chaque page et chaque action.
export const MODULES = [
  { code: "licences", nom: "Licences", pret: true },
  { code: "projets", nom: "Projets", pret: true },
  { code: "concours", nom: "Concours & CA", pret: true },
  { code: "agenda", nom: "Agenda", pret: true },
  { code: "factures", nom: "Factures", pret: false },
  { code: "relations", nom: "Relations", pret: false },
] as const;

export type CodeModule = (typeof MODULES)[number]["code"];
export type Niveau = "aucun" | "lecture" | "ecriture";
export const NIVEAUX: Niveau[] = ["aucun", "lecture", "ecriture"];
const RANG: Record<Niveau, number> = { aucun: 0, lecture: 1, ecriture: 2 };

export type Droits = Partial<Record<string, Niveau>>;
export type Personne = { role: string; actif?: boolean | null };

export function estModule(m: string): m is CodeModule {
  return MODULES.some((x) => x.code === m);
}

export function estNiveau(n: string): n is Niveau {
  return (NIVEAUX as string[]).includes(n);
}

/** Niveau effectif d'une personne sur un module. */
export function niveau(p: Personne, droits: Droits, module: string): Niveau {
  if (p.actif === false) return "aucun";
  if (p.role === "admin") return "ecriture";
  const n = droits[module];
  return n && estNiveau(n) ? n : "aucun";
}

export function peut(p: Personne, droits: Droits, module: string, voulu: Exclude<Niveau, "aucun">): boolean {
  return RANG[niveau(p, droits, module)] >= RANG[voulu];
}

/** Onglets visibles dans le menu. */
export function modulesVisibles(p: Personne, droits: Droits) {
  return MODULES.filter((m) => peut(p, droits, m.code, "lecture"));
}
