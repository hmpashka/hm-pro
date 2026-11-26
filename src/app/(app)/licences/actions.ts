"use server";
import { revalidatePath } from "next/cache";
import { noter } from "@/lib/audit";
import { exigerDroit } from "@/lib/session";
import { type ActionCompte, type Produit, PRODUITS, agir } from "@/lib/live";

type Retour = { ok?: string; erreur?: string; secret?: string };
const ACTIONS: ActionCompte[] = ["activer", "bloquer", "debloquer", "mot_de_passe", "deconnecter", "enregistrer"];

export async function actionLicence(_: Retour, f: FormData): Promise<Retour> {
  const c = await exigerDroit("licences", "ecriture");
  const produit = String(f.get("produit")) as Produit;
  const compte = String(f.get("compte"));
  const action = String(f.get("action")) as ActionCompte;
  if (!PRODUITS.some((p) => p.code === produit) || !ACTIONS.includes(action) || !/^[0-9a-z]{4,64}$/.test(compte)) return { erreur: "Demande invalide" };
  const champs: Record<string, unknown> = {};
  if (action === "enregistrer") {
    const fin = String(f.get("fin") ?? "");
    if (fin && !/^\d{4}-\d{2}-\d{2}$/.test(fin)) return { erreur: "Date invalide" };
    champs.fin = fin;
    champs.note = String(f.get("note") ?? "").slice(0, 300);
    const pm = Number(f.get("postes_max"));
    if (Number.isFinite(pm) && pm >= 0) champs.postes_max = Math.min(500, Math.floor(pm));
  }
  try {
    const r = await agir(produit, compte, action, champs);
    await noter({ userId: c.user.id, email: c.user.email, action: "licence_" + action, cible: produit + ":" + compte,
                  details: action === "enregistrer" ? { fin: champs.fin, postes_max: champs.postes_max } : null, ip: c.ip });
    revalidatePath("/licences");
    const mdp = typeof r.mot_de_passe === "string" ? r.mot_de_passe : undefined;
    return mdp ? { ok: "Nouveau mot de passe à transmettre au client :", secret: mdp } : { ok: "Fait." };
  } catch (e) {
    return { erreur: e instanceof Error ? e.message : "Erreur" };
  }
}
