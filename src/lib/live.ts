// Client de l'« accès service » de live.hmphotographie.fr (module-service.php du dépôt sporttiming).
// Requêtes signées HMAC-SHA256 ; la clé ne circule jamais. Appelé uniquement côté serveur.
import { createHash, createHmac, randomBytes } from "node:crypto";

export type Produit = "hm-timings" | "gestovet" | "piquage";
export const PRODUITS: { code: Produit; nom: string }[] = [
  { code: "hm-timings", nom: "HM TIMINGS" },
  { code: "gestovet", nom: "Gestovet" },
  { code: "piquage", nom: "Atelier Piquage" },
];

export type Poste = { id: string; nom: string; version: string; ip: string; vu: number; connecte?: boolean; bloque?: boolean };
export type Compte = {
  id: string; nom: string; mail: string; statut: string; note: string; postesMax: number;
  cree: number; vu: number; fin: number; essaiFin: number; finDate: string; postes: Poste[];
};
export type ActionCompte = "activer" | "bloquer" | "debloquer" | "mot_de_passe" | "deconnecter" | "enregistrer";

export class ErreurLive extends Error {
  constructor(message: string, public code: number) { super(message); }
}

type Reglage = { url: string; cle: string; delaiMs?: number; fetch?: typeof fetch };

function reglage(): Reglage {
  const url = (process.env.LIVE_URL ?? "").replace(/\/$/, "");
  const cle = process.env.LIVE_CLE_SERVICE ?? "";
  if (!url || cle.length < 40) throw new ErreurLive("LIVE_URL ou LIVE_CLE_SERVICE manquant", 503);
  return { url, cle };
}

export function signer(cle: string, methode: string, uri: string, horodatage: string, nonce: string, corps: string): string {
  const empreinte = createHash("sha256").update(corps).digest("hex");
  return createHmac("sha256", cle).update([methode, uri, horodatage, nonce, empreinte].join("\n")).digest("hex");
}

export async function appeler<T = Record<string, unknown>>(uri: string, corps?: unknown, r: Reglage = reglage()): Promise<T> {
  const methode = corps === undefined ? "GET" : "POST";
  const texte = corps === undefined ? "" : JSON.stringify(corps);
  const essais = methode === "GET" ? 3 : 1; // jamais de nouvelle tentative sur une écriture
  let derniere: unknown;
  for (let i = 0; i < essais; i++) {
    const ts = String(Math.floor(Date.now() / 1000));
    const nonce = randomBytes(18).toString("base64url");
    try {
      const rep = await (r.fetch ?? fetch)(r.url + uri, {
        method: methode,
        body: methode === "POST" ? texte : undefined,
        headers: {
          "Content-Type": "application/json",
          "X-HM-Horodatage": ts,
          "X-HM-Nonce": nonce,
          "X-HM-Signature": signer(r.cle, methode, uri, ts, nonce, texte),
        },
        signal: AbortSignal.timeout(r.delaiMs ?? 10_000),
        cache: "no-store",
      });
      const j = (await rep.json().catch(() => ({}))) as Record<string, unknown>;
      if (!rep.ok) throw new ErreurLive(String(j.erreur ?? "live.hm a répondu " + rep.status), rep.status);
      return j as T;
    } catch (e) {
      derniere = e;
      if (e instanceof ErreurLive && e.code < 500 && e.code !== 429) throw e;
      if (i < essais - 1) await new Promise((ok) => setTimeout(ok, 400 * (i + 1)));
    }
  }
  throw derniere instanceof Error ? derniere : new ErreurLive("live.hm injoignable", 502);
}

function adresse(p: Produit): { lire: string; ecrire: string; plus: Record<string, string> } {
  if (p === "hm-timings") return { lire: "/admin/api/comptes", ecrire: "/admin/api/comptes", plus: {} };
  if (p === "gestovet") return { lire: "/admin/api/gestovet", ecrire: "/admin/api/gestovet", plus: {} };
  return { lire: "/admin/api/produits?produit=" + p, ecrire: "/admin/api/produits", plus: { produit: p } };
}

type Brut = Record<string, unknown>;
const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);
const s = (v: unknown) => (v == null ? "" : String(v));

/** Met les trois formats du site (HM TIMINGS, Gestovet, produits) sous une seule forme. */
export function normaliser(p: Produit, rep: Brut): Compte[] {
  const comptes = (rep.comptes as Brut[] | undefined) ?? [];
  const postesHm = (rep.postes as Brut[] | undefined) ?? [];
  return comptes.map((c) => {
    const postesBruts = p === "hm-timings" ? postesHm.filter((x) => s(x.compte) === s(c.id)) : ((c.postes as Brut[] | undefined) ?? []);
    const statut = p === "gestovet" ? s(c.statut_site || c.statut) : s(c.statut);
    return {
      id: s(c.id), nom: s(c.nom || c.clinique), mail: s(c.mail), statut: statut || "essai", note: s(c.note),
      postesMax: n(c.postes_max), cree: n(c.cree), vu: n(c.vu), fin: n(c.fin_ms), essaiFin: n(c.essai_fin_ms), finDate: s(c.fin_date),
      postes: postesBruts.map((x) => ({ id: s(x.id), nom: s(x.nom), version: s(x.version), ip: s(x.ip), vu: n(x.vu),
                                        connecte: Boolean(x.connecte), bloque: Boolean(x.bloque) })),
    };
  });
}

export async function comptes(p: Produit, r?: Reglage): Promise<Compte[]> {
  return normaliser(p, await appeler<Brut>(adresse(p).lire, undefined, r));
}

export async function agir(p: Produit, compte: string, action: ActionCompte, champs: Record<string, unknown> = {}, r?: Reglage) {
  const a = adresse(p);
  return appeler<Brut>(a.ecrire, { ...a.plus, ...champs, action, compte }, r);
}

export async function etat(r?: Reglage) {
  return appeler<Brut>("/admin/api/service/etat", undefined, r);
}

export type Resume = { total: number; actifs: number; essais: number; bloques: number; expirentBientot: Compte[]; essaisFinis: Compte[] };

/** Ce qui demande une action : essais terminés sans activation, licences qui expirent dans 30 jours. */
export function resumer(liste: Compte[], maintenant = Date.now()): Resume {
  const j30 = maintenant + 30 * 86400_000;
  return {
    total: liste.length,
    actifs: liste.filter((c) => c.statut === "actif").length,
    essais: liste.filter((c) => c.statut === "essai").length,
    bloques: liste.filter((c) => c.statut === "bloque" || c.statut === "suspendu").length,
    expirentBientot: liste.filter((c) => c.statut === "actif" && c.fin > 0 && c.fin <= j30),
    essaisFinis: liste.filter((c) => c.statut === "essai" && c.essaiFin > 0 && c.essaiFin < maintenant),
  };
}
