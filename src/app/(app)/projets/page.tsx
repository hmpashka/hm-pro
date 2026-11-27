import Link from "next/link";
import { exigerDroit } from "@/lib/session";
import { peut } from "@/lib/droits";
import { type Depot, depots } from "@/lib/github";
import { PRIORITES, STATUTS, SUIVI_VIDE, type Suivi, suivis } from "@/lib/projets";
import Formulaire from "@/composants/formulaire";
import { actionProjet, actualiser } from "./actions";

export const dynamic = "force-dynamic";
const JOUR = 86400_000;
const FILTRES = { actifs: "En cours et en pause", ...STATUTS, inactifs: "En cours, rien depuis 30 j", tous: "Tous", masques: "Masqués" } as const;
type Filtre = keyof typeof FILTRES;
const RANG_PRIO = { haute: 0, normale: 1, basse: 2 } as const;

function depuis(ms: number, maintenant: number) {
  if (!ms) return "jamais";
  const j = Math.floor((maintenant - ms) / JOUR);
  if (j < 1) { const h = Math.floor((maintenant - ms) / 3600_000); return h < 1 ? "à l'instant" : `il y a ${h} h`; }
  if (j < 60) return `il y a ${j} j`;
  return "le " + new Date(ms).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
}

function garder(f: Filtre, s: Suivi, d: Depot, maintenant: number) {
  if (f === "masques") return s.masque;
  if (s.masque) return false;
  if (f === "tous") return true;
  if (f === "actifs") return s.statut === "en_cours" || s.statut === "en_pause";
  if (f === "inactifs") return s.statut === "en_cours" && maintenant - d.pousse > 30 * JOUR;
  return s.statut === f;
}

export default async function Projets({ searchParams }: { searchParams: Promise<{ filtre?: string; q?: string }> }) {
  const ctx = await exigerDroit("projets", "lecture");
  const ecriture = peut(ctx.user, ctx.droits, "projets", "ecriture");
  const sp = await searchParams;
  const filtre = (sp.filtre && sp.filtre in FILTRES ? sp.filtre : "actifs") as Filtre;
  const q = (sp.q ?? "").trim().toLowerCase();

  let liste: Depot[] = [];
  let erreur = "";
  try { liste = await depots(); } catch (e) { erreur = e instanceof Error ? e.message : "GitHub injoignable"; }
  const suivi = await suivis();
  const s = (d: Depot) => suivi.get(d.complet) ?? SUIVI_VIDE;
  const maintenant = Date.now();
  const visibles = liste.filter((d) => !s(d).masque);
  const enCours = visibles.filter((d) => s(d).statut === "en_cours");
  const vus = liste.filter((d) => garder(filtre, s(d), d, maintenant))
    .filter((d) => !q || (d.nom + " " + d.description + " " + s(d).note + " " + s(d).prochaine).toLowerCase().includes(q))
    .sort((a, b) => RANG_PRIO[s(a).priorite] - RANG_PRIO[s(b).priorite] || b.pousse - a.pousse);

  return (
    <>
      <div className="ligne" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h1 style={{ margin: 0 }}>Projets</h1>
        <Formulaire action={actualiser}><button>Actualiser depuis GitHub</button></Formulaire>
      </div>
      {erreur ? <p className="message danger">{erreur}</p> : (
        <>
          <div className="grille" style={{ marginTop: 12 }}>
            <Link href="/projets?filtre=en_cours" className="carte"><div className="doux">En cours</div><div className="chiffre">{enCours.length}</div></Link>
            <Link href="/projets?filtre=inactifs" className="carte"><div className="doux">En cours, rien depuis 30 j</div>
              <div className="chiffre alerte">{enCours.filter((d) => maintenant - d.pousse > 30 * JOUR).length}</div></Link>
            <div className="carte"><div className="doux">PR ouvertes</div><div className="chiffre">{visibles.reduce((n, d) => n + d.prs.length, 0)}</div></div>
            <div className="carte"><div className="doux">Tickets ouverts</div><div className="chiffre">{visibles.reduce((n, d) => n + d.tickets, 0)}</div></div>
          </div>
          <h2>Dépôts</h2>
          <form className="ligne" method="get" action="/projets">
            <select name="filtre" defaultValue={filtre}>{Object.entries(FILTRES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <input name="q" placeholder="Rechercher" defaultValue={q} />
            <button>Filtrer</button>
          </form>
          <p className="doux petit">{vus.length} projet(s) sur {liste.length} dépôt(s)</p>
          {vus.map((d) => {
            const x = s(d);
            const dernier = d.commits[0];
            return (
              <details key={d.complet} className="carte" style={{ marginBottom: 8 }}>
                <summary>
                  <strong>{d.nom}</strong>{" "}
                  <span className={"pastille " + (x.statut === "en_cours" ? "actif" : x.statut === "en_pause" ? "essai" : x.statut === "abandonne" ? "bloque" : "")}>{STATUTS[x.statut]}</span>
                  {x.priorite === "haute" && <span className="pastille bloque" style={{ marginLeft: 4 }}>prioritaire</span>}
                  {d.prs.length > 0 && <span className="pastille" style={{ marginLeft: 4 }}>{d.prs.length} PR</span>}{" "}
                  <span className="doux petit">· {depuis(d.pousse, maintenant)}{dernier && <> · {dernier.message.slice(0, 70)}</>}</span>
                  {x.prochaine && <div className="petit">➜ {x.prochaine}</div>}
                </summary>
                <div className="petit" style={{ margin: "10px 0", display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <a href={d.url} target="_blank" rel="noopener noreferrer">Ouvrir sur GitHub ↗</a>
                  <a href={d.url + "/pulls"} target="_blank" rel="noopener noreferrer">PR ↗</a>
                  <a href={d.url + "/issues"} target="_blank" rel="noopener noreferrer">Tickets ({d.tickets}) ↗</a>
                  <a href={d.url + "/branches"} target="_blank" rel="noopener noreferrer">Branches ↗</a>
                  <span className="doux">{d.prive ? "privé" : "public"}{d.langue && " · " + d.langue} · branche {d.branche}{d.archive && " · archivé"}</span>
                </div>
                {d.description && <p className="doux petit">{d.description}</p>}
                {d.prs.length > 0 && (<><h3 className="petit">PR ouvertes</h3><ul className="petit">
                  {d.prs.map((p) => <li key={p.numero}><a href={p.url} target="_blank" rel="noopener noreferrer">#{p.numero} {p.titre}</a>
                    <span className="doux"> · {p.branche}{p.brouillon && " · brouillon"} · {depuis(p.date, maintenant)}</span></li>)}
                </ul></>)}
                {d.commits.length > 0 && (<><h3 className="petit">Derniers commits</h3><ul className="petit">
                  {d.commits.map((c) => <li key={c.sha}><a href={c.url} target="_blank" rel="noopener noreferrer"><code>{c.sha}</code></a> {c.message}
                    <span className="doux"> · {c.auteur} · {depuis(c.date, maintenant)}</span></li>)}
                </ul></>)}
                {x.note && !ecriture && <p className="petit" style={{ whiteSpace: "pre-wrap" }}>{x.note}</p>}
                {ecriture && (
                  <Formulaire action={actionProjet} className="">
                    <input type="hidden" name="depot" value={d.complet} />
                    <div className="ligne" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <label>Statut<select name="statut" defaultValue={x.statut}>{Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                      <label>Priorité<select name="priorite" defaultValue={x.priorite}>{Object.entries(PRIORITES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                      <label style={{ flex: 1, minWidth: 200 }}>Prochaine étape<input name="prochaine" defaultValue={x.prochaine} maxLength={300} /></label>
                    </div>
                    <label style={{ marginTop: 8 }}>Note<textarea name="note" defaultValue={x.note} rows={3} maxLength={3000} /></label>
                    <div className="ligne" style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
                      <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="masque" value="1" defaultChecked={x.masque} /> Masquer ce dépôt</label>
                      <button className="principal">Enregistrer</button>
                    </div>
                  </Formulaire>
                )}
              </details>
            );
          })}
        </>
      )}
    </>
  );
}
