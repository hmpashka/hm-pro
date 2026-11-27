"use server";
import { revalidatePath } from "next/cache";
import { noter } from "@/lib/audit";
import { exigerDroit } from "@/lib/session";
import { PRIORITES, STATUTS, enregistrer } from "@/lib/projets";
import { viderCache } from "@/lib/github";

type Retour = { ok?: string; erreur?: string };

export async function actionProjet(_: Retour, f: FormData): Promise<Retour> {
  const c = await exigerDroit("projets", "ecriture");
  const depot = String(f.get("depot") ?? "");
  const statut = String(f.get("statut") ?? "");
  const priorite = String(f.get("priorite") ?? "");
  if (!/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(depot) || !(statut in STATUTS) || !(priorite in PRIORITES)) return { erreur: "Demande invalide" };
  const masque = f.get("masque") === "1";
  await enregistrer(depot, { statut: statut as keyof typeof STATUTS, priorite: priorite as keyof typeof PRIORITES, masque,
    prochaine: String(f.get("prochaine") ?? "").slice(0, 300), note: String(f.get("note") ?? "").slice(0, 3000) }, c.user.id);
  await noter({ userId: c.user.id, email: c.user.email, action: "projet_suivi", cible: depot, details: { statut, priorite, masque }, ip: c.ip });
  revalidatePath("/projets");
  return { ok: "Enregistré." };
}

export async function actualiser(_r?: Retour, _f?: FormData): Promise<Retour> { void _r; void _f;
  await exigerDroit("projets", "lecture");
  viderCache();
  revalidatePath("/projets");
  return { ok: "Actualisé." };
}
