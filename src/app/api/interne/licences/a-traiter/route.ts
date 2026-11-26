import { jetonInterneOk, refus } from "@/lib/interne";
import { PRODUITS, comptes, resumer } from "@/lib/live";

export const dynamic = "force-dynamic";

/** Pour n8n : ce qui demande une action (relances d'essai, renouvellements J-30). Mails inclus pour l'envoi. */
export async function GET(req: Request) {
  if (!(await jetonInterneOk(req))) return refus();
  try {
    const out = await Promise.all(PRODUITS.map(async (p) => {
      const r = resumer(await comptes(p.code));
      const court = (c: { id: string; nom: string; mail: string; fin: number; essaiFin: number }) =>
        ({ id: c.id, nom: c.nom, mail: c.mail, fin: c.fin ? new Date(c.fin).toISOString() : null, essai_fin: c.essaiFin ? new Date(c.essaiFin).toISOString() : null });
      return { produit: p.code, nom: p.nom, essais_finis: r.essaisFinis.map(court), expirent_30j: r.expirentBientot.map(court) };
    }));
    return Response.json({ produits: out, t: new Date().toISOString() });
  } catch (e) {
    return Response.json({ erreur: e instanceof Error ? e.message : "live.hm injoignable" }, { status: 502 });
  }
}
