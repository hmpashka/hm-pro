// Client de live.hm : signature, formats, et essai réel contre le site PHP (dépôt sporttiming) si disponible.
import { createHmac, createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agir, appeler, comptes, normaliser, resumer, signer } from "@/lib/live";

describe("signature", () => {
  it("suit exactement le format de module-service.php", () => {
    const corps = '{"a":1}';
    const attendu = createHmac("sha256", "cle").update(["POST", "/admin/api/comptes", "1700000000", "nonce-nonce-nonce", createHash("sha256").update(corps).digest("hex")].join("\n")).digest("hex");
    expect(signer("cle", "POST", "/admin/api/comptes", "1700000000", "nonce-nonce-nonce", corps)).toBe(attendu);
  });
});

describe("formats du site", () => {
  it("Gestovet : nom de la clinique et statut du site", () => {
    const [c] = normaliser("gestovet", { comptes: [{ id: "ab12", clinique: "Clinique du Lac", statut: "suspendu", statut_site: "bloque", postes: [] }] });
    expect([c.nom, c.statut]).toEqual(["Clinique du Lac", "bloque"]);
  });
  it("HM TIMINGS : postes rattachés par compte", () => {
    const l = normaliser("hm-timings", { comptes: [{ id: "c1", nom: "A" }, { id: "c2", nom: "B" }], postes: [{ id: "p1", compte: "c2", nom: "PC" }] });
    expect(l.map((c) => c.postes.length)).toEqual([0, 1]);
  });
  it("résumé : essais finis et expirations à 30 jours", () => {
    const now = Date.parse("2026-12-01T00:00:00Z"), j = 86400_000;
    const base = { mail: "", note: "", postesMax: 0, cree: 0, vu: 0, finDate: "", postes: [] };
    const r = resumer([
      { ...base, id: "1", nom: "a", statut: "essai", fin: 0, essaiFin: now - j },
      { ...base, id: "2", nom: "b", statut: "actif", fin: now + 10 * j, essaiFin: 0 },
      { ...base, id: "3", nom: "c", statut: "actif", fin: now + 90 * j, essaiFin: 0 },
      { ...base, id: "4", nom: "d", statut: "bloque", fin: 0, essaiFin: 0 },
    ], now);
    expect([r.total, r.actifs, r.essais, r.bloques, r.essaisFinis.length, r.expirentBientot.map((c) => c.id)]).toEqual([4, 2, 1, 1, 1, ["2"]]);
  });
});

// ---------------------------------------------------------------- contre le vrai site PHP
const SOURCE = process.env.LIVE_SITE_SOURCE ?? "";
const avecSite = SOURCE && existsSync(join(SOURCE, "php", "module-service.php"));
const CLE = "c".repeat(48);

describe.skipIf(!avecSite)("contre le site live.hm (PHP)", () => {
  let php: ChildProcess;
  let url = "";
  const r = () => ({ url, cle: CLE });

  beforeAll(async () => {
    const site = mkdtempSync(join(tmpdir(), "live-"));
    cpSync(join(SOURCE, "php"), site, { recursive: true });
    cpSync(join(SOURCE, "..", "web"), join(site, "web"), { recursive: true });
    const secret = Buffer.alloc(32, 3).toString("base64");
    writeFileSync(join(site, "config.php"), `<?php return ['_secret_licences' => '${secret}', '_admin' => ['mot_de_passe' => 'x-admin-42'], '_service' => ['cle' => '${CLE}', 'ip' => ['127.0.0.1']]];`);
    const port = await new Promise<number>((ok) => { const s = createServer().listen(0, () => { const p = (s.address() as { port: number }).port; s.close(() => ok(p)); }); });
    php = spawn("php", ["-S", "127.0.0.1:" + port, "-t", site, join(site, "index.php")], { stdio: "ignore" });
    url = "http://127.0.0.1:" + port;
    for (let i = 0; i < 50; i++) { try { await fetch(url + "/"); break; } catch { await new Promise((ok) => setTimeout(ok, 100)); } }
    const creer = await fetch(url + "/api/piquage/compte/creer", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mail: "atelier@broderie.fr", mot_de_passe: "motdepasse", nom: "Atelier Broderie", poste: "0123456789abcdef01234567", nom_poste: "BUREAU", version: "1.0.0", essai_debut: Math.floor(Date.now() / 1000) - 3600 }) });
    expect(creer.status).toBe(200);
  });
  afterAll(() => { php?.kill(); });

  it("lit les comptes des trois logiciels", async () => {
    expect(await comptes("hm-timings", r())).toEqual([]);
    expect(await comptes("gestovet", r())).toEqual([]);
    const [c] = await comptes("piquage", r());
    expect([c.nom, c.statut, c.postes[0].nom]).toEqual(["Atelier Broderie", "essai", "BUREAU"]);
    expect(c.mail).not.toBe("atelier@broderie.fr"); // le site ne montre que le mail masqué
  });

  it("active, prolonge, bloque, change le mot de passe", async () => {
    const [c] = await comptes("piquage", r());
    await agir("piquage", c.id, "enregistrer", { fin: "2030-06-30", postes_max: 3, note: "client 42" }, r());
    await agir("piquage", c.id, "activer", {}, r());
    let [d] = await comptes("piquage", r());
    expect([d.statut, d.finDate, d.postesMax, d.note]).toEqual(["actif", "2030-06-30", 3, "client 42"]);
    await agir("piquage", c.id, "bloquer", {}, r());
    [d] = await comptes("piquage", r());
    expect(d.statut).toBe("bloque");
    const m = await agir("piquage", c.id, "mot_de_passe", {}, r());
    expect(typeof m.mot_de_passe).toBe("string");
    const j = await appeler<{ journal: { action: string }[] }>("/admin/api/service/journal", undefined, r());
    expect(j.journal.map((x) => x.action)).toContain("bloquer");
  });

  it("mauvaise clé : refus net, sans nouvelle tentative inutile", async () => {
    await expect(comptes("piquage", { url, cle: "z".repeat(48) })).rejects.toMatchObject({ code: 401 });
  });
});
