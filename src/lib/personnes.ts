// Création et gestion des comptes du tableau de bord (pas d'inscription publique).
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { auth } from "./auth";
import { estModule, estNiveau } from "./droits";

export function motDePasseProvisoire(): string {
  return randomBytes(12).toString("base64url"); // 16 caractères
}

export async function creerPersonne(p: { email: string; name: string; password: string; role: "admin" | "membre" }) {
  const email = p.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Adresse mail invalide");
  if (p.password.length < 12) throw new Error("Mot de passe : 12 caractères au moins");
  const ctx = await auth.$context;
  if (await ctx.internalAdapter.findUserByEmail(email)) throw new Error("Cette adresse a déjà un compte");
  const u = await ctx.internalAdapter.createUser({ email, name: p.name.trim() || email, emailVerified: true, role: p.role, actif: true }, { method: "admin" });
  await ctx.internalAdapter.linkAccount({ userId: u.id, providerId: "credential", accountId: u.id, password: await ctx.password.hash(p.password) });
  return u;
}

export async function fermerSessions(userId: string) {
  const ctx = await auth.$context;
  await ctx.internalAdapter.deleteUserSessions(userId);
}

export async function changerActif(userId: string, actif: boolean) {
  await db.update(schema.user).set({ actif, updatedAt: new Date() }).where(eq(schema.user.id, userId));
  if (!actif) await fermerSessions(userId);
}

/** Téléphone perdu : la 2FA est à refaire à la prochaine connexion. */
export async function reinitialiser2fa(userId: string) {
  await db.delete(schema.twoFactor).where(eq(schema.twoFactor.userId, userId));
  await db.update(schema.user).set({ twoFactorEnabled: false, updatedAt: new Date() }).where(eq(schema.user.id, userId));
  await fermerSessions(userId);
}

export async function nouveauMotDePasse(userId: string, password: string) {
  const ctx = await auth.$context;
  await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(password));
  await fermerSessions(userId);
}

export async function fixerDroit(userId: string, module: string, niveau: string) {
  if (!estModule(module) || !estNiveau(niveau)) throw new Error("Module ou niveau inconnu");
  await db.delete(schema.permission).where(and(eq(schema.permission.userId, userId), eq(schema.permission.module, module)));
  if (niveau !== "aucun") await db.insert(schema.permission).values({ userId, module, niveau });
}

export async function personnes() {
  const [u, p] = await Promise.all([db.select().from(schema.user).orderBy(schema.user.createdAt), db.select().from(schema.permission)]);
  return u.map((x) => ({ ...x, droits: Object.fromEntries(p.filter((d) => d.userId === x.id).map((d) => [d.module, d.niveau])) }));
}
