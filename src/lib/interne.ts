// Accès machine (n8n) : en-tête « Authorization: Bearer <N8N_JETON> ». Jamais de session, jamais d'écriture sur live.hm.
import { createHash, timingSafeEqual } from "node:crypto";
import { ipDe, noter } from "./audit";

export async function jetonInterneOk(req: Request): Promise<boolean> {
  const attendu = process.env.N8N_JETON ?? "";
  const recu = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (attendu.length < 32) return false;
  const a = createHash("sha256").update(attendu).digest();
  const b = createHash("sha256").update(recu).digest();
  const ok = timingSafeEqual(a, b);
  if (!ok) await noter({ action: "echec_jeton_interne", cible: new URL(req.url).pathname, ip: ipDe(req.headers) });
  return ok;
}

export const refus = () => Response.json({ erreur: "jeton refusé" }, { status: 401 });
