// Lecture des dépôts GitHub de HUGO pour l'onglet Projets. Jeton « fine-grained » en LECTURE SEULE (GITHUB_JETON) :
// HM Pro ne peut rien modifier sur GitHub. Réponses gardées 5 min en mémoire pour rester loin des limites de l'API.
import "server-only";

export type Commit = { sha: string; message: string; auteur: string; date: number; url: string };
export type Pr = { numero: number; titre: string; url: string; branche: string; brouillon: boolean; date: number };
export type Depot = {
  nom: string; complet: string; description: string; url: string; prive: boolean; archive: boolean;
  langue: string; branche: string; pousse: number; tickets: number; prs: Pr[]; commits: Commit[];
};

export class ErreurGithub extends Error {
  constructor(message: string, public code: number) { super(message); }
}

type Reglage = { api: string; jeton: string; fetch?: typeof fetch };
function reglage(): Reglage {
  const jeton = process.env.GITHUB_JETON ?? "";
  if (jeton.length < 20) throw new ErreurGithub("GITHUB_JETON manquant (voir deploiement/PROJETS.md)", 503);
  return { api: (process.env.GITHUB_API ?? "https://api.github.com").replace(/\/$/, ""), jeton };
}

async function lire<T>(chemin: string, r: Reglage): Promise<T> {
  const rep = await (r.fetch ?? fetch)(r.api + chemin, {
    headers: { Authorization: "Bearer " + r.jeton, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "hm-pro" },
    signal: AbortSignal.timeout(10_000), cache: "no-store",
  });
  if (rep.status === 409) return [] as T; // dépôt vide
  if (!rep.ok) {
    const j = (await rep.json().catch(() => ({}))) as { message?: string };
    throw new ErreurGithub(rep.status === 401 ? "Jeton GitHub refusé (expiré ?)" : "GitHub : " + (j.message ?? rep.status), rep.status);
  }
  return (await rep.json()) as T;
}

type Brut = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const t = (s: unknown) => (typeof s === "string" ? Date.parse(s) || 0 : 0);

export function normaliserDepot(d: Brut, prs: Brut[], commits: Brut[]): Depot {
  const vraisPrs = prs.map((p): Pr => ({ numero: p.number, titre: String(p.title ?? ""), url: String(p.html_url ?? ""),
    branche: String(p.head?.ref ?? ""), brouillon: !!p.draft, date: t(p.updated_at) }));
  return {
    nom: String(d.name), complet: String(d.full_name), description: String(d.description ?? ""), url: String(d.html_url),
    prive: !!d.private, archive: !!d.archived, langue: String(d.language ?? ""), branche: String(d.default_branch ?? "main"),
    pousse: t(d.pushed_at),
    tickets: Math.max(0, Number(d.open_issues_count ?? 0) - vraisPrs.length), // GitHub compte les PR dans les tickets
    prs: vraisPrs,
    commits: commits.map((c): Commit => ({ sha: String(c.sha ?? "").slice(0, 7), message: String(c.commit?.message ?? "").split("\n")[0],
      auteur: String(c.commit?.author?.name ?? c.author?.login ?? ""), date: t(c.commit?.author?.date), url: String(c.html_url ?? "") })),
  };
}

let cache: { t: number; depots: Depot[] } | null = null;
const DUREE = 5 * 60_000;

/** Tous les dépôts accessibles au jeton, du plus récemment modifié au plus ancien. */
export async function depots(forcer = false, r: Reglage = reglage()): Promise<Depot[]> {
  if (!forcer && cache && Date.now() - cache.t < DUREE) return cache.depots;
  const liste = await lire<Brut[]>("/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member", r);
  const res = await Promise.all(liste.map(async (d) => {
    const c = encodeURI(String(d.full_name));
    const [prs, commits] = await Promise.all([
      lire<Brut[]>(`/repos/${c}/pulls?state=open&per_page=30`, r).catch(() => []),
      lire<Brut[]>(`/repos/${c}/commits?per_page=5`, r).catch(() => []),
    ]);
    return normaliserDepot(d, prs, commits);
  }));
  res.sort((a, b) => b.pousse - a.pousse);
  cache = { t: Date.now(), depots: res };
  return res;
}

export function viderCache() { cache = null; }
