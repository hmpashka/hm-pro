import Link from "next/link";
import { exigerDroit } from "@/lib/session";
import { type Evenement, heureParis, jourParis } from "@/lib/agenda";
import { agendaComplet, joursDe } from "@/lib/agenda-hm";
import Formulaire from "@/composants/formulaire";
import { actualiserAgenda } from "./actions";

export const dynamic = "force-dynamic";
const JOUR = 86400_000;
const plus = (d: string, n: number) => { const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const debutMs = (d: string) => Date.parse(d + "T00:00:00Z") - 2 * 3600_000; // marge fuseau
const titreJour = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const NOMS_J = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

function Puce({ e }: { e: Evenement }) {
  const contenu = <>{!e.journee && <span className="doux">{heureParis(e.debut)} </span>}{e.titre}</>;
  return <div className={"ev " + (e.n < 0 ? "agc" : "ag" + (e.n % 4))} title={e.agenda + (e.lieu ? " · " + e.lieu : "")}>
    {e.lien ? <Link href={e.lien}>{contenu}</Link> : contenu}</div>;
}

export default async function Agenda({ searchParams }: { searchParams: Promise<{ vue?: string; d?: string }> }) {
  const ctx = await exigerDroit("agenda", "lecture");
  const sp = await searchParams;
  const auj = jourParis(Date.now());
  const vue = sp.vue === "mois" ? "mois" : "liste";
  const d = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : auj;

  let jours: string[];
  let precedent: string, suivant: string, titre: string;
  if (vue === "mois") {
    const premier = d.slice(0, 8) + "01";
    const decal = (new Date(premier + "T12:00:00Z").getUTCDay() + 6) % 7;
    const depart = plus(premier, -decal);
    jours = Array.from({ length: 42 }, (_, i) => plus(depart, i));
    const m = new Date(premier + "T12:00:00Z");
    precedent = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
    suivant = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
    titre = m.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
  } else {
    jours = Array.from({ length: 14 }, (_, i) => plus(d, i));
    precedent = plus(d, -14); suivant = plus(d, 14);
    titre = "Du " + titreJour(jours[0]).replace(/^\S+ /, "") + " au " + titreJour(jours[13]).replace(/^\S+ /, "");
  }
  const r = await agendaComplet(ctx.user, ctx.droits, debutMs(jours[0]), debutMs(jours[jours.length - 1]) + JOUR + 4 * 3600_000);
  const parJour = new Map<string, Evenement[]>();
  for (const e of r.evenements) for (const j of joursDe(e)) parJour.set(j, [...(parJour.get(j) ?? []), e]);
  const lien = (x: Record<string, string>) => "/agenda?" + new URLSearchParams({ vue, d, ...x }).toString();

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Agenda</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a className="bouton" href="https://calendar.google.com/calendar/r/eventedit" target="_blank" rel="noopener noreferrer">+ Nouveau rendez-vous ↗</a>
          <Formulaire action={actualiserAgenda}><button>Actualiser</button></Formulaire>
        </div>
      </div>
      {!r.regle && <p className="message alerte">Aucun agenda Google relié. Voir deploiement/AGENDA.md (3 min).</p>}
      {r.erreurs.map((x) => <p key={x} className="message danger">{x}</p>)}
      <div className="onglets" style={{ marginTop: 12, alignItems: "center" }}>
        <Link href={lien({ vue: "liste" })} className={vue === "liste" ? "actif" : ""}>14 jours</Link>
        <Link href={lien({ vue: "mois" })} className={vue === "mois" ? "actif" : ""}>Mois</Link>
        <span style={{ flex: 1 }} />
        <Link href={lien({ d: precedent })} aria-label="Précédent">‹</Link>
        <Link href={lien({ d: auj })}>Aujourd&apos;hui</Link>
        <Link href={lien({ d: suivant })} aria-label="Suivant">›</Link>
      </div>
      <h2 style={{ marginTop: 0, textTransform: "capitalize" }}>{titre}</h2>

      {vue === "liste" ? (
        <div style={{ display: "grid", gap: 8 }}>
          {jours.map((j) => {
            const l = parJour.get(j) ?? [];
            return (
              <div key={j} className="carte" style={{ padding: "10px 14px", borderColor: j === auj ? "var(--accent)" : undefined, opacity: l.length ? 1 : .6 }}>
                <div className="petit" style={{ fontWeight: 600, textTransform: "capitalize", color: j === auj ? "var(--accent)" : undefined }}>
                  {j === auj ? "Aujourd'hui · " : ""}{titreJour(j)}</div>
                {l.length === 0 ? <div className="doux petit">—</div> : l.map((e) => (
                  <div key={e.id + j} className={"ligne-ev " + (e.n < 0 ? "agc" : "ag" + (e.n % 4))}>
                    <span className="heure">{e.journee ? "journée" : heureParis(e.debut) + "–" + heureParis(e.fin)}</span>
                    <span>{e.lien ? <Link href={e.lien}>{e.titre}</Link> : e.titre}
                      <span className="doux petit">{e.lieu && " · " + e.lieu}{" · " + e.agenda}</span></span>
                  </div>))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mois">
          {NOMS_J.map((n) => <div key={n} className="doux petit" style={{ textAlign: "center" }}>{n}</div>)}
          {jours.map((j) => (
            <div key={j} className={"case" + (j === auj ? " auj" : "") + (j.slice(0, 7) !== (d.slice(0, 7)) ? " hors" : "")}>
              <Link href={"/agenda?vue=liste&d=" + j} className="petit num">{Number(j.slice(8))}</Link>
              {(parJour.get(j) ?? []).slice(0, 4).map((e) => <Puce key={e.id + j} e={e} />)}
              {(parJour.get(j)?.length ?? 0) > 4 && <div className="petit doux">+{parJour.get(j)!.length - 4}</div>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
