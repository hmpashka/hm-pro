"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { noter } from "@/lib/audit";
import { exigerDroit } from "@/lib/session";
import { ajouterVente, supprimerVente } from "@/lib/concours";
import { centimes, estDate, estMoyen, euros } from "@/lib/montants";

type Retour = { ok?: string; erreur?: string };
const id = (f: FormData, k = "concours") => { const n = Number(f.get(k)); return Number.isInteger(n) && n > 0 ? n : null; };

function champsConcours(f: FormData) {
  const nom = String(f.get("nom") ?? "").trim().slice(0, 120);
  const lieu = String(f.get("lieu") ?? "").trim().slice(0, 120);
  const debut = String(f.get("debut") ?? "");
  const fin = String(f.get("fin") ?? "") || debut;
  const obj = String(f.get("objectif") ?? "").trim();
  const objectifCentimes = obj ? centimes(obj) : null;
  if (!nom) return { erreur: "Nom obligatoire" };
  if (!estDate(debut) || !estDate(fin) || fin < debut) return { erreur: "Dates invalides" };
  if (obj && (objectifCentimes === null || objectifCentimes < 0)) return { erreur: "Objectif invalide" };
  return { v: { nom, lieu, debut, fin, objectifCentimes, note: String(f.get("note") ?? "").slice(0, 2000) } };
}

export async function creerConcours(_: Retour, f: FormData): Promise<Retour> {
  const c = await exigerDroit("concours", "ecriture");
  const r = champsConcours(f);
  if (!r.v) return { erreur: r.erreur };
  const [n] = await db.insert(schema.concours).values(r.v).returning({ id: schema.concours.id });
  await noter({ userId: c.user.id, email: c.user.email, action: "concours_creer", cible: String(n.id), details: { nom: r.v.nom }, ip: c.ip });
  revalidatePath("/concours");
  redirect("/concours/" + n.id);
}

export async function modifierConcours(_: Retour, f: FormData): Promise<Retour> {
  const c = await exigerDroit("concours", "ecriture");
  const n = id(f);
  const r = champsConcours(f);
  if (!n) return { erreur: "Demande invalide" };
  if (!r.v) return { erreur: r.erreur };
  await db.update(schema.concours).set(r.v).where(eq(schema.concours.id, n));
  await noter({ userId: c.user.id, email: c.user.email, action: "concours_modifier", cible: String(n), ip: c.ip });
  revalidatePath("/concours", "layout");
  return { ok: "Enregistré." };
}

export async function supprimerConcours(_: Retour, f: FormData): Promise<Retour> {
  const c = await exigerDroit("concours", "ecriture");
  const n = id(f);
  if (!n) return { erreur: "Demande invalide" };
  const [x] = await db.delete(schema.concours).where(eq(schema.concours.id, n)).returning();
  if (x) await noter({ userId: c.user.id, email: c.user.email, action: "concours_supprimer", cible: String(n), details: { nom: x.nom }, ip: c.ip });
  revalidatePath("/concours");
  redirect("/concours");
}

export async function ajouter(_: Retour, f: FormData): Promise<Retour> {
  const c = await exigerDroit("concours", "ecriture");
  const n = id(f);
  const moyen = String(f.get("moyen") ?? "");
  const m = centimes(String(f.get("montant") ?? ""));
  if (!n || !estMoyen(moyen)) return { erreur: "Demande invalide" };
  if (m === null) return { erreur: "Montant invalide (ex. 25 ou 12,50)" };
  await ajouterVente({ concoursId: n, moyen, centimes: m, libelle: String(f.get("libelle") ?? "").trim(), saisiPar: c.user.id });
  revalidatePath("/concours", "layout");
  return { ok: `${euros(m)} ajouté.` };
}

export async function retirer(_: Retour, f: FormData): Promise<Retour> {
  const c = await exigerDroit("concours", "ecriture");
  const n = id(f);
  const v = id(f, "vente");
  if (!n || !v) return { erreur: "Demande invalide" };
  const x = await supprimerVente(n, v);
  if (x) await noter({ userId: c.user.id, email: c.user.email, action: "vente_supprimer", cible: n + ":" + v,
                       details: { centimes: x.centimes, moyen: x.moyen }, ip: c.ip });
  revalidatePath("/concours", "layout");
  return { ok: "Supprimé." };
}
