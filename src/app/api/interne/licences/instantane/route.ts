import { db, schema } from "@/db";
import { chiffrerJson } from "@/lib/chiffrement";
import { jetonInterneOk, refus } from "@/lib/interne";
import { PRODUITS, comptes, resumer } from "@/lib/live";

export const dynamic = "force-dynamic";

/** Pour n8n (toutes les 15 min) : copie chiffrée des comptes de chaque logiciel, pour l'historique et les stats. */
export async function POST(req: Request) {
  if (!(await jetonInterneOk(req))) return refus();
  try {
    const lignes = await Promise.all(PRODUITS.map(async (p) => {
      const liste = await comptes(p.code);
      const r = resumer(liste);
      return { produit: p.code, total: r.total, actifs: r.actifs, essais: r.essais, bloques: r.bloques, contenuC: chiffrerJson(liste) };
    }));
    await db.insert(schema.licenceInstantane).values(lignes);
    return Response.json({ ok: true, produits: lignes.map(({ contenuC: _, ...x }) => x) });
  } catch (e) {
    return Response.json({ erreur: e instanceof Error ? e.message : "erreur" }, { status: 502 });
  }
}
