import { describe, expect, it } from "vitest";
import { depots, normaliserDepot, viderCache } from "@/lib/github";

const depot = (nom: string, pousse: string, extra: Record<string, unknown> = {}) => ({
  name: nom, full_name: "hmpashka/" + nom, html_url: "https://github.com/hmpashka/" + nom, private: true,
  default_branch: "main", pushed_at: pousse, open_issues_count: 3, language: "PHP", description: "desc " + nom, ...extra,
});

function fauxGithub(appels: string[]) {
  return (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    appels.push(u);
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer " + "j".repeat(40));
    const rep = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
    if (u.includes("/user/repos")) return rep([depot("vieux", "2026-01-01T00:00:00Z"), depot("vide", "2026-05-01T00:00:00Z"), depot("recent", "2026-11-27T10:00:00Z")]);
    if (u.includes("/vide/")) return rep({ message: "Git Repository is empty." }, 409);
    if (u.includes("/pulls")) return rep(u.includes("recent") ? [{ number: 7, title: "Ajout", html_url: "https://x/7", head: { ref: "br" }, draft: false, updated_at: "2026-11-27T09:00:00Z" }] : []);
    if (u.includes("/commits")) return rep([{ sha: "abcdef1234567", html_url: "https://x/c", commit: { message: "Titre\n\ncorps", author: { name: "Hugo", date: "2026-11-27T10:00:00Z" } } }]);
    return rep({}, 404);
  }) as typeof fetch;
}

describe("GitHub (onglet Projets)", () => {
  it("normalise un dépôt : PR retirées du compte de tickets, message de commit sur une ligne", () => {
    const d = normaliserDepot(depot("a", "2026-11-01T00:00:00Z"), [{ number: 1, title: "t", head: { ref: "x" } }], [{ sha: "1234567890", commit: { message: "a\nb", author: { name: "H", date: "2026-11-01T00:00:00Z" } } }]);
    expect(d.tickets).toBe(2);
    expect(d.commits[0]).toMatchObject({ sha: "1234567", message: "a", auteur: "H" });
  });

  it("liste les dépôts du plus récent au plus ancien, dépôt vide toléré, cache 5 min", async () => {
    viderCache();
    const appels: string[] = [];
    const r = { api: "https://api.test", jeton: "j".repeat(40), fetch: fauxGithub(appels) };
    const l = await depots(false, r);
    expect(l.map((d) => d.nom)).toEqual(["recent", "vide", "vieux"]);
    expect(l[0].prs[0]).toMatchObject({ numero: 7, branche: "br" });
    expect(l[1].commits).toEqual([]);
    const n = appels.length;
    await depots(false, r);
    expect(appels.length).toBe(n);
    await depots(true, r);
    expect(appels.length).toBe(2 * n);
  });

  it("jeton refusé : message clair", async () => {
    viderCache();
    const r = { api: "https://api.test", jeton: "j".repeat(40), fetch: (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch };
    await expect(depots(false, r)).rejects.toThrow("Jeton GitHub refusé");
  });
});
