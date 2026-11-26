import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { auth } from "./auth";
import { type Droits, type Niveau, peut } from "./droits";
import { ipDe, noter } from "./audit";

export type Contexte = {
  user: { id: string; email: string; name: string; role: string; actif: boolean; twoFactorEnabled: boolean };
  droits: Droits;
  ip: string | null;
};

export async function droitsDe(userId: string): Promise<Droits> {
  const lignes = await db.select().from(schema.permission).where(eq(schema.permission.userId, userId));
  return Object.fromEntries(lignes.map((l) => [l.module, l.niveau as Niveau]));
}

/** Session obligatoire, 2FA obligatoire. Sinon redirige. */
export async function exigerSession(options: { sans2fa?: boolean } = {}): Promise<Contexte> {
  const h = await headers();
  const s = await auth.api.getSession({ headers: h });
  if (!s) redirect("/connexion");
  const u = s.user as Contexte["user"];
  if (u.actif === false) redirect("/connexion");
  if (!options.sans2fa && !u.twoFactorEnabled) redirect("/activer-2fa");
  return { user: u, droits: await droitsDe(u.id), ip: ipDe(h) };
}

export async function exigerDroit(module: string, voulu: Exclude<Niveau, "aucun">): Promise<Contexte> {
  const c = await exigerSession();
  if (!peut(c.user, c.droits, module, voulu)) {
    await noter({ userId: c.user.id, email: c.user.email, action: "refus_droit", cible: module + ":" + voulu, ip: c.ip });
    redirect("/?refus=" + encodeURIComponent(module));
  }
  return c;
}

export async function exigerAdmin(): Promise<Contexte> {
  const c = await exigerSession();
  if (c.user.role !== "admin") redirect("/");
  return c;
}
