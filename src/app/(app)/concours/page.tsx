import Link from "next/link";
import { exigerDroit } from "@/lib/session";
import { peut } from "@/lib/droits";
import { listeConcours, parMois, totauxParConcours } from "@/lib/concours";
import { ETATS, MOYENS, type Moyen, aujourdhui, etat, euros } from "@/lib/montants";
import Formulaire from "@/composants/formulaire";
import { creerConcours } from "./actions";

export const dynamic = "force-dynamic";
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const COULEUR: Record<Moyen, string> = { especes: "var(--ok)", cb: "var(--accent)", en_ligne: "var(--alerte)" };
const jour = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

export default async function Concours({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  const ctx = await exigerDroit("concours", "lecture");
  const ecriture = peut(ctx.user, ctx.droits, "concours", "ecriture");
  const auj = aujourdhui();
  const [tous, totaux] = await Promise.all([listeConcours(), totauxParConcours()]);
  const annees = [...new Set([Number(auj.slice(0, 4)), ...tous.map((c) => Number(c.debut.slice(0, 4)))])].sort((a, b) => b - a);
  const a = Number((await searchParams).annee);
  const annee = annees.includes(a) ? a : annees[0];
  const mois = await parMois(annee);
  const t = (id: number) => totaux.get(id);
  const deLAnnee = tous.filter((c) => c.debut.startsWith(String(annee)));
  const ca = deLAnnee.reduce((n, c) => n + (t(c.id)?.total ?? 0), 0);
  const parMoyen = (m: Moyen) => deLAnnee.reduce((n, c) => n + (t(c.id)?.[m] ?? 0), 0);
  const termines = deLAnnee.filter((c) => etat(c.debut, c.fin, auj) === "termine" && t(c.id));
  const meilleur = [...deLAnnee].sort((x, y) => (t(y.id)?.total ?? 0) - (t(x.id)?.total ?? 0))[0];
  const actuels = tous.filter((c) => etat(c.debut, c.fin, auj) !== "termine").sort((x, y) => x.debut.localeCompare(y.debut));
  const maxMois = Math.max(1, ...[...mois.values()].map((m) => m.total));

  return (
    <>
      <h1>Concours & CA</h1>
      {actuels.length > 0 && (
        <div className="grille" style={{ marginBottom: 12 }}>
          {actuels.slice(0, 4).map((c) => {
            const e = etat(c.debut, c.fin, auj);
            return (
              <Link key={c.id} href={"/concours/" + c.id} className="carte" style={{ color: "inherit", borderColor: e === "en_cours" ? "var(--ok)" : undefined }}>
                <span className={"pastille " + (e === "en_cours" ? "actif" : "")}>{ETATS[e]}</span>
                <div><strong>{c.nom}</strong></div>
                <div className="doux petit">{jour(c.debut)}{c.fin !== c.debut && " → " + jour(c.fin)}{c.lieu && " · " + c.lieu}</div>
                {e === "en_cours" && <div className="chiffre ok">{euros(t(c.id)?.total ?? 0)}</div>}
              </Link>
            );
          })}
        </div>
      )}
      <div className="onglets">
        {annees.map((x) => <Link key={x} href={"/concours?annee=" + x} className={x === annee ? "actif" : ""}>{x}</Link>)}
      </div>
      <div className="grille">
        <div className="carte"><div className="doux">CA {annee}</div><div className="chiffre">{euros(ca)}</div>
          <div className="petit doux">{(Object.keys(MOYENS) as Moyen[]).map((m) => MOYENS[m] + " " + euros(parMoyen(m))).join(" · ")}</div></div>
        <div className="carte"><div className="doux">Concours</div><div className="chiffre">{deLAnnee.length}</div></div>
        <div className="carte"><div className="doux">Moyenne par concours terminé</div>
          <div className="chiffre">{euros(termines.length ? Math.round(termines.reduce((n, c) => n + t(c.id)!.total, 0) / termines.length) : 0)}</div></div>
        {meilleur && t(meilleur.id) && <Link href={"/concours/" + meilleur.id} className="carte" style={{ color: "inherit" }}><div className="doux">Meilleur concours</div>
          <div><strong>{meilleur.nom}</strong></div><div className="ok">{euros(t(meilleur.id)!.total)}</div></Link>}
      </div>

      <h2>Par mois</h2>
      <div className="carte" style={{ display: "grid", gap: 6 }}>
        {MOIS.map((nom, i) => {
          const m = mois.get(`${annee}-${String(i + 1).padStart(2, "0")}`);
          return (
            <div key={nom} style={{ display: "grid", gridTemplateColumns: "48px 1fr 90px", gap: 8, alignItems: "center" }} className="petit">
              <span className="doux">{nom}</span>
              <div style={{ display: "flex", height: 14, borderRadius: 4, overflow: "hidden", background: "var(--fond)" }}
                   title={m ? (Object.keys(MOYENS) as Moyen[]).map((k) => MOYENS[k] + " " + euros(m[k])).join(" · ") : ""}>
                {m && (Object.keys(MOYENS) as Moyen[]).map((k) => m[k] > 0 &&
                  <div key={k} style={{ width: (100 * m[k] / maxMois) + "%", background: COULEUR[k] }} />)}
              </div>
              <span style={{ textAlign: "right" }}>{m ? euros(m.total) : ""}</span>
            </div>
          );
        })}
        <div className="petit doux">{(Object.keys(MOYENS) as Moyen[]).map((k) => <span key={k} style={{ marginRight: 12 }}>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: COULEUR[k], marginRight: 4 }} />{MOYENS[k]}</span>)}</div>
      </div>

      <h2>Concours {annee}</h2>
      {deLAnnee.length === 0 ? <p className="doux">Aucun concours.</p> : (
        <div className="defile"><table><thead><tr><th>Concours</th><th>Dates</th><th>Espèces</th><th>CB</th><th>En ligne</th><th>Total</th></tr></thead><tbody>
          {deLAnnee.map((c) => { const x = t(c.id); return (
            <tr key={c.id}><td><Link href={"/concours/" + c.id}>{c.nom}</Link>{c.lieu && <div className="doux petit">{c.lieu}</div>}</td>
              <td className="petit">{jour(c.debut)}{c.fin !== c.debut && " → " + jour(c.fin)}</td>
              <td>{euros(x?.especes ?? 0)}</td><td>{euros(x?.cb ?? 0)}</td><td>{euros(x?.en_ligne ?? 0)}</td><td><strong>{euros(x?.total ?? 0)}</strong></td></tr>); })}
        </tbody></table></div>
      )}

      {ecriture && (
        <>
          <h2>Nouveau concours</h2>
          <Formulaire action={creerConcours} className="ligne carte">
            <label style={{ flex: 2, minWidth: 180 }}>Nom<input name="nom" required maxLength={120} /></label>
            <label style={{ flex: 1, minWidth: 140 }}>Lieu<input name="lieu" maxLength={120} /></label>
            <label>Début<input type="date" name="debut" required defaultValue={auj} /></label>
            <label>Fin<input type="date" name="fin" /></label>
            <label style={{ width: 120 }}>Objectif (€)<input name="objectif" inputMode="decimal" /></label>
            <button className="principal">Créer</button>
          </Formulaire>
        </>
      )}
    </>
  );
}
