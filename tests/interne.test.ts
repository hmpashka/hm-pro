import { describe, expect, it } from "vitest";
import { jetonInterneOk } from "@/lib/interne";

describe("accès n8n", () => {
  const req = (h?: string) => new Request("http://x/api/interne/licences/a-traiter", { headers: h ? { authorization: h } : {} });
  it("bon jeton accepté, tout le reste refusé", async () => {
    expect(await jetonInterneOk(req("Bearer " + process.env.N8N_JETON))).toBe(true);
    expect(await jetonInterneOk(req("Bearer faux"))).toBe(false);
    expect(await jetonInterneOk(req())).toBe(false);
  });
  it("jeton trop court côté serveur : tout est refusé", async () => {
    const j = process.env.N8N_JETON;
    process.env.N8N_JETON = "court";
    expect(await jetonInterneOk(req("Bearer court"))).toBe(false);
    process.env.N8N_JETON = j;
  });
});
