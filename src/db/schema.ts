// Tables de Better Auth (connexion, sessions, 2FA, limites) + tables du tableau de bord.
import { boolean, integer, bigint, date, jsonb, pgTable, primaryKey, serial, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  role: text("role").notNull().default("membre"), // admin | membre
  actif: boolean("actif").notNull().default(true),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (t) => [index("session_user_idx").on(t.userId)]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("account_user_idx").on(t.userId)]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const twoFactor = pgTable("two_factor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  verified: boolean("verified").default(true),
  failedVerificationCount: integer("failed_verification_count").default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
}, (t) => [index("two_factor_user_idx").on(t.userId), index("two_factor_secret_idx").on(t.secret)]);

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// ---------------------------------------------------------------- tableau de bord

/** Droit d'un membre sur un module (onglet). Pas de ligne = aucun accès. Un admin a tout. */
export const permission = pgTable("permission", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  module: text("module").notNull(),
  niveau: text("niveau").notNull(), // lecture | ecriture
}, (t) => [primaryKey({ columns: [t.userId, t.module] })]);

/** Journal d'audit : jamais modifié ni effacé depuis l'appli. */
export const audit = pgTable("audit", {
  id: serial("id").primaryKey(),
  t: timestamp("t", { withTimezone: true }).notNull().defaultNow(),
  userId: text("user_id"),
  email: text("email"),
  action: text("action").notNull(),
  cible: text("cible"),
  details: jsonb("details"),
  ip: text("ip"),
}, (t) => [index("audit_t_idx").on(t.t)]);

/** Copie périodique des licences de live.hm (historique et stats). Contenu chiffré : mails et notes des clients. */
export const licenceInstantane = pgTable("licence_instantane", {
  id: serial("id").primaryKey(),
  t: timestamp("t", { withTimezone: true }).notNull().defaultNow(),
  produit: text("produit").notNull(),
  total: integer("total").notNull(),
  actifs: integer("actifs").notNull(),
  essais: integer("essais").notNull(),
  bloques: integer("bloques").notNull(),
  contenuC: text("contenu_c").notNull(),
}, (t) => [index("licence_instantane_idx").on(t.produit, t.t)]);

/** Suivi d'un dépôt GitHub dans l'onglet Projets. Prochaine étape et note chiffrées. */
export const projet = pgTable("projet", {
  depot: text("depot").primaryKey(), // propriétaire/nom
  statut: text("statut").notNull().default("en_cours"),
  priorite: text("priorite").notNull().default("normale"),
  masque: boolean("masque").notNull().default(false),
  contenuC: text("contenu_c"),
  maj: timestamp("maj", { withTimezone: true }).notNull().defaultNow(),
  majPar: text("maj_par"),
});

/** Concours couvert par HM Photographie. */
export const concours = pgTable("concours", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  lieu: text("lieu").notNull().default(""),
  debut: date("debut").notNull(), // AAAA-MM-JJ
  fin: date("fin").notNull(),
  objectifCentimes: integer("objectif_centimes"),
  note: text("note").notNull().default(""),
  cree: timestamp("cree", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("concours_debut_idx").on(t.debut)]);

/** Une vente (ou un total saisi d'un coup). Montant en centimes ; négatif pour un remboursement. */
export const vente = pgTable("vente", {
  id: serial("id").primaryKey(),
  concoursId: integer("concours_id").notNull().references(() => concours.id, { onDelete: "cascade" }),
  t: timestamp("t", { withTimezone: true }).notNull().defaultNow(),
  moyen: text("moyen").notNull(), // especes | cb | en_ligne
  centimes: integer("centimes").notNull(),
  libelle: text("libelle").notNull().default(""),
  ref: text("ref"), // identifiant externe (galerie en ligne) : jamais deux fois
  saisiPar: text("saisi_par"),
}, (t) => [index("vente_concours_idx").on(t.concoursId, t.t), uniqueIndex("vente_ref_idx").on(t.ref)]);
