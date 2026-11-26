// Parcours réel de connexion contre PostgreSQL : mot de passe, 2FA obligatoire, codes, blocage, compte désactivé, journal.
import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const avecBase = Boolean(process.env.DATABASE_URL);

function base32(s: string): Buffer {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of s.replace(/=+$/, "").toUpperCase()) bits += a.indexOf(ch).toString(2).padStart(5, "0");
  return Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
}
function totp(secret: string, t = Date.now()): string {
  const c = Buffer.alloc(8);
  c.writeBigUInt64BE(BigInt(Math.floor(t / 30000)));
  const h = createHmac("sha1", base32(secret)).update(c).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

describe.skipIf(!avecBase)("connexion et double authentification", async () => {
  const { auth } = await import("@/lib/auth");
  const { db, schema, sql } = await import("@/db");
  const { creerPersonne, changerActif, reinitialiser2fa } = await import("@/lib/personnes");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const ORIGINE = "http://localhost:3000";
  const MDP = "un-mot-de-passe-solide";
  let ip = 1;

  async function appel(chemin: string, corps?: unknown, cookies = "", ipFixe?: string) {
    const rep = await auth.handler(new Request(ORIGINE + "/api/auth" + chemin, {
      method: corps === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", origin: ORIGINE, cookie: cookies, "x-real-ip": ipFixe ?? "10.0.0." + ip++ },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    }));
    const cuits = rep.headers.getSetCookie().map((c) => c.split(";")[0]).filter((c) => !c.endsWith("="));
    const texte = await rep.text();
    return { statut: rep.status, corps: texte ? JSON.parse(texte) : null, cookies: cuits.join("; ") };
  }

  beforeAll(async () => {
    await sql.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    await migrate(drizzle(sql), { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
    await creerPersonne({ email: "Hugo@Exemple.fr", name: "Hugo", password: MDP, role: "admin" });
  });
  afterAll(async () => { await sql.end(); });

  it("pas d'inscription publique", async () => {
    const r = await appel("/sign-up/email", { email: "pirate@exemple.fr", password: "aaaaaaaaaaaaaaa", name: "x" });
    expect(r.statut).toBeGreaterThanOrEqual(400);
  });

  let secret = "";
  let codesSecours: string[] = [];
  it("première connexion puis activation de la 2FA", async () => {
    const c = await appel("/sign-in/email", { email: "hugo@exemple.fr", password: MDP });
    expect(c.statut).toBe(200);
    expect(c.corps.twoFactorRedirect).toBeFalsy();
    const s = await appel("/get-session", undefined, c.cookies);
    expect(s.corps.user.twoFactorEnabled).toBe(false); // l'appli redirige vers /activer-2fa tant que c'est faux
    const e = await appel("/two-factor/enable", { password: MDP, method: "totp" }, c.cookies);
    expect(e.statut).toBe(200);
    secret = new URL(e.corps.totpURI).searchParams.get("secret")!;
    codesSecours = e.corps.backupCodes;
    expect(codesSecours.length).toBe(10);
    expect((await appel("/two-factor/verify-totp", { code: "000000" }, c.cookies)).statut).toBe(401);
    const v = await appel("/two-factor/verify-totp", { code: totp(secret) }, c.cookies);
    expect(v.statut).toBe(200);
    expect((await appel("/get-session", undefined, v.cookies || c.cookies)).corps.user.twoFactorEnabled).toBe(true);
  });

  it("ensuite, le mot de passe seul ne suffit plus", async () => {
    const c = await appel("/sign-in/email", { email: "hugo@exemple.fr", password: MDP });
    expect(c.corps.twoFactorRedirect).toBe(true);
    expect((await appel("/get-session", undefined, c.cookies)).corps).toBeNull();
    const v = await appel("/two-factor/verify-totp", { code: totp(secret) }, c.cookies);
    expect(v.statut).toBe(200);
    expect((await appel("/get-session", undefined, v.cookies)).corps.user.email).toBe("hugo@exemple.fr");
  });

  it("un code de secours ne sert qu'une fois", async () => {
    const c1 = await appel("/sign-in/email", { email: "hugo@exemple.fr", password: MDP });
    expect((await appel("/two-factor/verify-backup-code", { code: codesSecours[0] }, c1.cookies)).statut).toBe(200);
    const c2 = await appel("/sign-in/email", { email: "hugo@exemple.fr", password: MDP });
    expect((await appel("/two-factor/verify-backup-code", { code: codesSecours[0] }, c2.cookies)).statut).toBeGreaterThanOrEqual(400);
  });

  it("5 mauvais mots de passe depuis une adresse : bloquée", async () => {
    const statuts = [];
    for (let i = 0; i < 6; i++) statuts.push((await appel("/sign-in/email", { email: "hugo@exemple.fr", password: "mauvais-mot-de-passe" }, "", "10.9.9.9")).statut);
    expect(statuts.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuts[5]).toBe(429);
    expect((await appel("/sign-in/email", { email: "hugo@exemple.fr", password: MDP }, "", "10.9.9.9")).statut).toBe(429);
  });

  it("compte désactivé : plus de connexion ; 2FA réinitialisée : à refaire", async () => {
    const u = await creerPersonne({ email: "aide@exemple.fr", name: "Aide", password: MDP, role: "membre" });
    await changerActif(u.id, false);
    expect((await appel("/sign-in/email", { email: "aide@exemple.fr", password: MDP })).statut).toBeGreaterThanOrEqual(400);
    await changerActif(u.id, true);
    expect((await appel("/sign-in/email", { email: "aide@exemple.fr", password: MDP })).statut).toBe(200);
    await reinitialiser2fa(u.id);
    const [x] = await db.select().from(schema.user).where((await import("drizzle-orm")).eq(schema.user.id, u.id));
    expect(x.twoFactorEnabled).toBe(false);
  });

  it("le journal garde connexions et échecs, sans mot de passe", async () => {
    const j = await db.select().from(schema.audit);
    const actions = j.map((x) => x.action);
    expect(actions).toContain("connexion");
    expect(actions.some((a) => a.startsWith("echec_sign-in"))).toBe(true);
    expect(JSON.stringify(j)).not.toContain(MDP);
  });

  it("les mots de passe ne sont jamais stockés en clair", async () => {
    const comptes = await db.select().from(schema.account);
    expect(comptes.every((c) => c.password && !c.password.includes(MDP))).toBe(true);
    const tf = await db.select().from(schema.twoFactor);
    expect(tf.every((t) => t.secret !== secret)).toBe(true);
  });
});
