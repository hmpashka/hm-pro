import { exigerSession } from "@/lib/session";
import { MODULES, NIVEAUX } from "@/lib/droits";
import { personnes } from "@/lib/personnes";
import { derniers } from "@/lib/audit";
import Formulaire from "@/composants/formulaire";
import { ajouterPersonne, changerDroit, gererPersonne } from "./actions";

export const dynamic = "force-dynamic";
const date = (d: Date) => d.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });

export default async function Reglages() {
  const c = await exigerSession();
  const admin = c.user.role === "admin";
  const [liste, journal] = admin ? await Promise.all([personnes(), derniers(200)]) : [[], []];
  return (
    <>
      <h1>Réglages</h1>
      <div className="carte">
        <strong>{c.user.name}</strong> <span className="doux">{c.user.email}</span>
        <div className="petit">Rôle : {admin ? "administrateur" : "membre"} · Double authentification : <span className="ok">active</span></div>
      </div>

      {admin && (
        <>
          <h2>Personnes et droits</h2>
          <div className="defile">
            <table>
              <thead><tr><th>Personne</th>{MODULES.map((m) => <th key={m.code}>{m.nom}</th>)}<th>Compte</th></tr></thead>
              <tbody>
                {liste.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}<div className="doux petit">{u.email}</div>
                      <div className="petit">{u.role === "admin" ? "admin" : "membre"} · {u.twoFactorEnabled ? "2FA ok" : <span className="alerte">2FA à activer</span>}
                        {!u.actif && <> · <span className="danger">désactivé</span></>}</div></td>
                    {MODULES.map((m) => (
                      <td key={m.code}>
                        {u.role === "admin" ? <span className="doux petit">tout</span> : (
                          <form action={changerDroit} className="ligne">
                            <input type="hidden" name="user" value={u.id} /><input type="hidden" name="module" value={m.code} />
                            <select name="niveau" defaultValue={u.droits[m.code] ?? "aucun"}>
                              {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <button className="petit">OK</button>
                          </form>
                        )}
                      </td>
                    ))}
                    <td>
                      {u.id !== c.user.id && (
                        <Formulaire action={gererPersonne} confirmer="Confirmer cette action sur le compte ?">
                          <input type="hidden" name="user" value={u.id} />
                          <select name="op" defaultValue="">
                            <option value="" disabled>Action…</option>
                            <option value="mdp">Nouveau mot de passe</option>
                            <option value="reset2fa">Refaire la 2FA</option>
                            {u.actif ? <option value="desactiver">Désactiver</option> : <option value="reactiver">Réactiver</option>}
                          </select>
                          <button>OK</button>
                        </Formulaire>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>Ajouter une personne</h2>
          <div className="carte">
            <Formulaire action={ajouterPersonne}>
              <label>Nom<input name="nom" required /></label>
              <label>Mail<input name="email" type="email" required /></label>
              <label>Rôle<select name="role" defaultValue="membre"><option value="membre">membre (droits par onglet)</option><option value="admin">admin (tout)</option></select></label>
              <button className="principal">Créer</button>
            </Formulaire>
            <p className="doux petit">La personne se connecte avec le mot de passe provisoire puis doit activer la 2FA. Aucun onglet tant que vous ne lui donnez pas de droit.</p>
          </div>

          <h2>Journal</h2>
          <div className="defile">
            <table>
              <thead><tr><th>Quand</th><th>Qui</th><th>Action</th><th>Cible</th><th>IP</th></tr></thead>
              <tbody>
                {journal.map((j) => (
                  <tr key={j.id}>
                    <td className="petit">{date(j.t)}</td>
                    <td className="petit">{j.email ?? liste.find((u) => u.id === j.userId)?.email ?? ""}</td>
                    <td className={j.action.startsWith("echec") || j.action === "refus_droit" ? "danger petit" : "petit"}>{j.action}</td>
                    <td className="petit">{j.cible}{j.details ? " " + JSON.stringify(j.details) : ""}</td>
                    <td className="petit doux">{j.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
