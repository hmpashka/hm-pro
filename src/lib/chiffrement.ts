// Chiffrement des champs sensibles (AES-256-GCM). La clé (32 octets en base64) vient de CHIFFREMENT_CLE,
// jamais de la base : une copie volée de la base reste illisible.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function cle(): Buffer {
  const b64 = process.env.CHIFFREMENT_CLE ?? "";
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("CHIFFREMENT_CLE doit faire 32 octets en base64 (openssl rand -base64 32)");
  return k;
}

export function chiffrer(texte: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cle(), iv);
  const ct = Buffer.concat([c.update(texte, "utf8"), c.final()]);
  return "v1:" + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}

export function dechiffrer(valeur: string): string {
  if (!valeur.startsWith("v1:")) throw new Error("format inconnu");
  const b = Buffer.from(valeur.slice(3), "base64");
  const d = createDecipheriv("aes-256-gcm", cle(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}

export function chiffrerJson(v: unknown): string {
  return chiffrer(JSON.stringify(v));
}

export function dechiffrerJson<T>(v: string): T {
  return JSON.parse(dechiffrer(v)) as T;
}
