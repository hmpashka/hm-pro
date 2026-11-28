import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerDroit } from "@/lib/session";
import { peut } from "@/lib/droits";
import { unConcours } from "@/lib/concours";
import { ETATS, MOYENS, type Moyen, etat, euros } from "@/lib/montants";
import Formulaire from "@/composants/formulaire";
import { ajouter, modifierConcours, retirer, supprimerConcours } from "../actions";

export const dynamic = "force-dynamic";
const jourLong = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" });
const heure = (t: Date) => t.toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function UnConcours({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await exigerDroit("concours", "lecture");
  const ecriture = peut(ctx.user, ctx.droits, "concours", "ecriture");
  const n = Number((await params).id);
  const d = Number.isInteger(n) && n > 0 ? await unConcours(n) : null;
  if (!d) notFound();
  const { c, ventes, totaux, parJour } = d;
  const e = etat(c.debut, c.fin);
  const pct = c.objectifCentimes ? Math.min(100, Math.round(100 * totaux.total / c.objectifCentimes)) : null;

  return (
    <>
      <p className="petit"><Link href={"/concours?annee=" + c.debut.slice(0, 4)}>← Concours & CA</Link></p>
      <h1 style={{ marginBottom: 4 }}>{c.nom} <span className={"pastille " + (e === "en_cours" ? "actif" : "")}>{ETATS[e]}</span></h1>
      <p className="doux" style={{ marginTop: 0 }}>{jourLong(c.debut)}{c.fin !== c.debut && " → " + jourLong(c.fin)}{c.lieu && " · " + c.lieu}</p>

      <div className="grille">
        <div className="carte"><div className="doux">Total</div><div className="chiffre ok">{euros(totaux.total)}</div>
          <div className="petit doux">{totaux.ventes} vente(s){totaux.ventes > 0 && " · panier moyen " + euros(Math.round(totaux.total / totaux.ventes))}</div>
          {pct !== null && <><div style={{ height: 8, background: "var(--fond)", borderRadius: 4, marginTop: 6 }}>
            <div style={{ width: pct + "%", height: 8, background: "var(--ok)", borderRadius: 4 }} /></div>
            <div className="petit doux">{pct} % de l&apos;objectif ({euros(c.objectifCentimes!)})</div></>}
        </div>
        {(Object.keys(MOYENS) as Moyen[]).map((m) => <div key={m} className="carte"><div className="doux">{MOYENS[m]}</div><div className="chiffre">{euros(totaux[m])}</div></div>)}
      </div>

      {ecriture && (
        <>
          <h2>Ajouter une vente</h2>
          <Formulaire action={ajouter} className="carte saisie">
            <input type="hidden" name="concours" value={c.id} />
            <input name="montant" inputMode="decimal" placeholder="Montant (€)" required autoComplete="off" aria-label="Montant" className="montant" />
            <input name="libelle" placeholder="Détail (facultatif)" maxLength={120} autoComplete="off" aria-label="Détail" />
            <div className="moyens">
              {(Object.keys(MOYENS) as Moyen[]).map((m) => <button key={m} name="moyen" value={m} className={m === "especes" ? "principal" : ""}>{MOYENS[m]}</button>)}
            </div>
          </Formulaire>
          <p className="petit doux">Un total de fin de journée peut aussi être saisi en une fois. Montant négatif pour un remboursement.</p>
        </>
      )}

      {parJour.length > 1 && (
        <>
          <h2>Par jour</h2>
          <div className="defile"><table><thead><tr><th>Jour</th><th>Espèces</th><th>CB</th><th>En ligne</th><th>Total</th></tr></thead><tbody>
            {parJour.map(([j, x]) => <tr key={j}><td>{jourLong(j)}</td><td>{euros(x.especes)}</td><td>{euros(x.cb)}</td><td>{euros(x.en_ligne)}</td><td><strong>{euros(x.total)}</strong></td></tr>)}
          </tbody></table></div>
        </>
      )}

      <h2>Ventes</h2>
      {ventes.length === 0 ? <p className="doux">Aucune vente pour l&apos;instant.</p> : (
        <div className="defile"><table><thead><tr><th>Quand</th><th>Moyen</th><th>Montant</th><th>Détail</th>{ecriture && <th />}</tr></thead><tbody>
          {ventes.slice(0, 300).map((v) => (
            <tr key={v.id}><td className="petit">{heure(v.t)}</td><td>{MOYENS[v.moyen as Moyen] ?? v.moyen}</td>
              <td className={v.centimes < 0 ? "danger" : ""}>{euros(v.centimes)}</td><td className="petit doux">{v.libelle}{v.ref && " (auto)"}</td>
              {ecriture && <td><Formulaire action={retirer} confirmer={`Supprimer cette vente de ${euros(v.centimes)} ?`}>
                <input type="hidden" name="concours" value={c.id} /><input type="hidden" name="vente" value={v.id} />
                <button className="danger petit" aria-label="Supprimer">✕</button></Formulaire></td>}
            </tr>))}
        </tbody></table></div>
      )}

      {c.note && !ecriture && <p className="petit" style={{ whiteSpace: "pre-wrap" }}>{c.note}</p>}
      {ecriture && (
        <details className="carte" style={{ marginTop: 16 }}>
          <summary>Modifier le concours</summary>
          <Formulaire action={modifierConcours} className="ligne">
            <input type="hidden" name="concours" value={c.id} />
            <label style={{ flex: 2, minWidth: 180 }}>Nom<input name="nom" required defaultValue={c.nom} maxLength={120} /></label>
            <label style={{ flex: 1, minWidth: 140 }}>Lieu<input name="lieu" defaultValue={c.lieu} maxLength={120} /></label>
            <label>Début<input type="date" name="debut" required defaultValue={c.debut} /></label>
            <label>Fin<input type="date" name="fin" defaultValue={c.fin} /></label>
            <label style={{ width: 120 }}>Objectif (€)<input name="objectif" inputMode="decimal" defaultValue={c.objectifCentimes ? String(c.objectifCentimes / 100).replace(".", ",") : ""} /></label>
            <label style={{ flexBasis: "100%" }}>Note<textarea name="note" rows={2} defaultValue={c.note} maxLength={2000} /></label>
            <button className="principal">Enregistrer</button>
          </Formulaire>
          <Formulaire action={supprimerConcours} confirmer={`Supprimer « ${c.nom} » et ses ${ventes.length} vente(s) ? C'est définitif.`}>
            <input type="hidden" name="concours" value={c.id} />
            <button className="danger" style={{ marginTop: 12 }}>Supprimer le concours</button>
          </Formulaire>
        </details>
      )}
    </>
  );
}
