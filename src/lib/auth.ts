import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { db, schema } from "@/db";
import { ipDe, noter } from "./audit";

const PRODUCTION = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  appName: "HM Pro",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification,
              twoFactor: schema.twoFactor, rateLimit: schema.rateLimit },
  }),
  // pas d'inscription publique : comptes créés par « npm run creer-admin » puis par l'admin dans Réglages
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128, autoSignIn: false },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "membre", input: false },
      actif: { type: "boolean", required: false, defaultValue: true, input: false },
    },
  },
  session: { expiresIn: 60 * 60 * 12, updateAge: 60 * 60, freshAge: 60 * 15 },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    // 5 essais par quart d'heure : mot de passe, code 2FA, code de secours
    customRules: {
      "/sign-in/email": { window: 900, max: 5 },
      "/two-factor/verify-totp": { window: 900, max: 5 },
      "/two-factor/verify-backup-code": { window: 900, max: 5 },
      "/two-factor/enable": { window: 900, max: 5 },
    },
  },
  advanced: {
    cookiePrefix: "hmpro",
    useSecureCookies: PRODUCTION,
    defaultCookieAttributes: { sameSite: "strict", httpOnly: true, secure: PRODUCTION },
    ipAddress: { ipAddressHeaders: ["x-real-ip"] },
  },
  trustedOrigins: process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : [],
  plugins: [twoFactor({ issuer: "HM Pro", totpOptions: { digits: 6, period: 30 } }), nextCookies()],
  databaseHooks: {
    session: {
      create: {
        // compte désactivé par l'admin : aucune session
        before: async (s) => {
          const u = await db.query.user.findFirst({ where: (t, { eq }) => eq(t.id, s.userId) });
          if (!u || u.actif === false) return false;
          return { data: s };
        },
        after: async (s) => {
          await noter({ userId: s.userId, action: "connexion", ip: s.ipAddress ?? null });
        },
      },
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const chemin = ctx.path ?? "";
      const sensible = chemin.startsWith("/sign-in") || chemin.startsWith("/two-factor/");
      if (!sensible) return;
      const r = ctx.context.returned as { status?: string; statusCode?: number } | undefined;
      const echec = r instanceof Error || (typeof r?.statusCode === "number" && r.statusCode >= 400);
      const ip = ctx.headers ? ipDe(ctx.headers) : null;
      const mail = typeof (ctx.body as { email?: unknown } | undefined)?.email === "string" ? (ctx.body as { email: string }).email : null;
      if (echec) await noter({ action: "echec_" + chemin.replace(/^\//, "").replace(/\//g, "_"), email: mail, ip });
      else if (chemin === "/two-factor/enable" || chemin === "/two-factor/disable")
        await noter({ userId: ctx.context.session?.user.id ?? null, action: "2fa" + chemin.slice(11), ip });
    }),
  },
});

export type Session = typeof auth.$Infer.Session;
