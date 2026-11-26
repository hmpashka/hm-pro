import Link from "next/link";
import { exigerDroit } from "@/lib/session";
import { peut } from "@/lib/droits";
import { type Compte, type Produit, PRODUITS, comptes, resumer } from "@/lib/live";
import Formulaire from "@/composants/formulaire";
import { actionLicence } from "./actions";

export const dynamic = "force-dynamic";
const FILTRES = { tous: "Tous", essai: "En essai", actif: "Actifs", bientot: "Expirent sous 30 j", bloque: "Bloqués" } as const;
type Filtre = keyof typeof FILTRES;
const jour = (ms: number) => (ms ? new Date(ms).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : "");

function garder(c: Compte, f: Filtre, maintenant: number) {
  if (f === "essai") return c.statut === "essai";
  if (f === "actif") return c.statut === "actif";
  if (f === "bloque") return c.statut === "bloque" || c.statut === "suspendu";
  if (f === "bientot") return c.statut === "actif" && c.fin > 0 && c.fin <= maintenant + 30 * 86400_000;
  return true;
}

export default async function Licences({ searchParams }: { searchParams: Promise<{ produit?: string; filtre?: string; q?: string }> }) {
  const ctx = await exigerDroit("licences", "lecture");
  const ecriture = peut(ctx.user, ctx.droits, "licences", "ecriture");
  const sp = await searchParams;
  const produit = (PRODUITS.find((p) => p.code === sp.produit)?.code ?? "hm-timings") as Produit;
  const filtre = (sp.filtre && sp.filtre in FILTRES ? sp.filtre : "tous") as Filtre;
  const q = (sp.q ?? "").trim().toLowerCase();
  const lien = (p: Partial<{ produit: string; filtre: string; q: string }>) =>
    "/licences?" + new URLSearchParams({ produit, filtre, ...(q ? { q } : {}), ...p }).toString();

  let liste: Compte[] = [];
  let erreur = "";
  try { liste = await comptes(produit); } catch (e) { erreur = e instanceof Error ? e.message : "live.hm injoignable"; }
  const maintenant = Date.now();
  const r = resumer(liste, maintenant);
  const vus = liste.filter((c) => garder(c, filtre, maintenant))
                   .filter((c) => !q || (c.nom + " " + c.mail + " " + c.note).toLowerCase().includes(q));

  return (
    <>
      <h1>Licences</h1>
      <div className="onglets">
        {PRODUITS.map((p) => <Link key={p.code} href={lien({ produit: p.code })} className={p.code === produit ? "actif" : ""}>{p.nom}</Link>)}
      </div>
      {erreur ? <p className="message danger">live.hm : {erreur}</p> : (
        <>
          <div className="grille">
            <div className="carte"><div className="doux">Comptes</div><div className="chiffre">{r.total}</div></div>
            <div className="carte"><div className="doux">Actifs</div><div className="chiffre ok">{r.actifs}</div></div>
            <div className="carte"><div className="doux">En essai</div><div className="chiffre alerte">{r.essais}</div>
              {r.essaisFinis.length > 0 && <div className="petit danger">{r.essaisFinis.length} essai(s) terminé(s) sans activation</div>}</div>
            <div className="carte"><div className="doux">Expirent sous 30 j</div><div className="chiffre">{r.expirentBientot.length}</div></div>
          </div>
          <h2>Comptes</h2>
          <form className="ligne" method="get" action="/licences">
            <input type="hidden" name="produit" value={produit} />
            <select name="filtre" defaultValue={filtre}>{Object.entries(FILTRES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <input name="q" placeholder="Rechercher (nom, mail, note)" defaultValue={q} />
            <button>Filtrer</button>
          </form>
          <p className="doux petit">{vus.length} compte(s)</p>
          {vus.map((c) => (
            <details key={c.id} className="carte" style={{ marginBottom: 8 }}>
              <summary>
                <strong>{c.nom || "(sans nom)"}</strong> <span className={"pastille " + (c.statut === "suspendu" ? "bloque" : c.statut)}>{c.statut}</span>{" "}
                <span className="doux petit">{c.mail}{c.fin ? " · fin " + jour(c.fin) : c.statut === "essai" && c.essaiFin ? " · essai jusqu'au " + jour(c.essaiFin) : ""}
                  {" · "}{c.postes.length} poste(s)</span>
              </summary>
              <div className="petit doux" style={{ margin: "8px 0" }}>Créé le {jour(c.cree)} · vu le {jour(c.vu)}{c.note && <> · note : {c.note}</>}</div>
              {c.postes.length > 0 && (
                <div className="defile"><table><thead><tr><th>Poste</th><th>Version</th><th>IP</th><th>Vu</th></tr></thead><tbody>
                  {c.postes.map((p) => <tr key={p.id}><td>{p.nom}{p.bloque && <span className="danger"> (bloqué)</span>}{p.connecte && <span className="ok"> ●</span>}</td>
                    <td>{p.version}</td><td className="doux">{p.ip}</td><td>{jour(p.vu)}</td></tr>)}
                </tbody></table></div>
              )}
              {ecriture && (
                <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                  <Formulaire action={actionLicence}>
                    <input type="hidden" name="produit" value={produit} /><input type="hidden" name="compte" value={c.id} />
                    <input type="hidden" name="action" value="enregistrer" />
                    <label>Fin de licence<input type="date" name="fin" defaultValue={c.finDate} /></label>
                    <label>Postes max (0 = illimité)<input type="number" name="postes_max" min={0} max={500} defaultValue={c.postesMax} style={{ width: 90 }} /></label>
                    <label>Note<input name="note" defaultValue={c.note} maxLength={300} /></label>
                    <button className="principal">Enregistrer</button>
                  </Formulaire>
                  <Formulaire action={actionLicence}>
                    <input type="hidden" name="produit" value={produit} /><input type="hidden" name="compte" value={c.id} />
                    {c.statut === "essai" && <button name="action" value="activer">Activer</button>}
                    {c.statut === "bloque" || c.statut === "suspendu"
                      ? <button name="action" value="debloquer">Débloquer</button>
                      : <button name="action" value="bloquer" className="danger" data-confirmer={"Bloquer " + c.nom + " ? Ses PC seront refusés au prochain signal."}>Bloquer</button>}
                    <button name="action" value="deconnecter" data-confirmer="Fermer toutes les sessions de ce compte ?">Déconnecter les PC</button>
                    <button name="action" value="mot_de_passe" data-confirmer="Générer un nouveau mot de passe ? L'ancien ne marchera plus.">Nouveau mot de passe</button>
                  </Formulaire>
                </div>
              )}
            </details>
          ))}
        </>
      )}
    </>
  );
}
