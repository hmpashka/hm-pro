"use server";
import { revalidatePath } from "next/cache";
import { noter } from "@/lib/audit";
import { exigerAdmin } from "@/lib/session";
import { changerActif, creerPersonne, fixerDroit, motDePasseProvisoire, nouveauMotDePasse, reinitialiser2fa } from "@/lib/personnes";

export type Retour = { ok?: string; erreur?: string; secret?: string };

export async function ajouterPersonne(_: Retour, f: FormData): Promise<Retour> {
  const c = await exigerAdmin();
  const mdp = motDePasseProvisoire();
  try {
    const role = f.get("role") === "admin" ? "admin" : "membre";
    const u = await creerPersonne({ email: String(f.get("email") ?? ""), name: String(f.get("nom") ?? ""), password: mdp, role });
    await noter({ userId: c.user.id, email: c.user.email, action: "personne_creee", cible: u.email, details: { role }, ip: c.ip });
    revalidatePath("/reglages");
    return { ok: "Compte créé pour " + u.email + ". Mot de passe provisoire (affiché une seule fois) :", secret: mdp };
  } catch (e) {
    return { erreur: e instanceof Error ? e.message : "Erreur" };
  }
}

export async function changerDroit(f: FormData) {
  const c = await exigerAdmin();
  const userId = String(f.get("user")), module = String(f.get("module")), niveau = String(f.get("niveau"));
  await fixerDroit(userId, module, niveau);
  await noter({ userId: c.user.id, email: c.user.email, action: "droit", cible: userId, details: { module, niveau }, ip: c.ip });
  revalidatePath("/reglages");
}

export async function gererPersonne(_: Retour, f: FormData): Promise<Retour> {
  const c = await exigerAdmin();
  const userId = String(f.get("user")), op = String(f.get("op"));
  if (userId === c.user.id) return { erreur: "Pas sur votre propre compte." };
  let retour: Retour = { ok: "Fait." };
  if (op === "desactiver") await changerActif(userId, false);
  else if (op === "reactiver") await changerActif(userId, true);
  else if (op === "reset2fa") await reinitialiser2fa(userId);
  else if (op === "mdp") {
    const mdp = motDePasseProvisoire();
    await nouveauMotDePasse(userId, mdp);
    retour = { ok: "Nouveau mot de passe provisoire (affiché une seule fois) :", secret: mdp };
  } else return { erreur: "Action inconnue" };
  await noter({ userId: c.user.id, email: c.user.email, action: "personne_" + op, cible: userId, ip: c.ip });
  revalidatePath("/reglages");
  return retour;
}
