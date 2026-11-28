// Lecture de Google Agenda par son « adresse secrète au format iCal » : lecture seule, aucun accès au compte Google.
// AGENDA_ICS = une ou plusieurs adresses séparées par des espaces, chacune pouvant être précédée d'un nom : « Pro|https://… ».
import ICAL from "ical.js";

export type Evenement = { id: string; titre: string; debut: number; fin: number; journee: boolean; lieu: string; agenda: string; n: number; lien?: string };
export type Source = { nom: string; url: string };

export function sources(v = process.env.AGENDA_ICS ?? ""): Source[] {
  return v.split(/\s+/).filter(Boolean).map((x, i) => {
    const [nom, url] = x.includes("|") ? [x.slice(0, x.indexOf("|")), x.slice(x.indexOf("|") + 1)] : ["Agenda" + (i ? " " + (i + 1) : ""), x];
    return { nom: nom.replace(/_/g, " "), url: url.replace(/^webcal:/, "https:") };
  }).filter((s) => /^https:\/\//.test(s.url));
}

const MAX_OCC = 1000;

// Fuseau de Paris toujours connu (Google l'envoie aussi, mais pas toutes les applis). Heures « flottantes » = heure de Paris.
const PARIS = `BEGIN:VTIMEZONE
TZID:Europe/Paris
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE`;
let parisPret = false;
function paris() {
  if (!parisPret) { ICAL.TimezoneService.register(new ICAL.Component(ICAL.parse(PARIS))); parisPret = true; }
  return ICAL.TimezoneService.get("Europe/Paris")!;
}

/** Instant (ms) d'une heure iCal. Journée entière : minuit UTC du jour (indépendant du fuseau du serveur). */
function ms(t: ICAL.Time): number {
  if (t.isDate) return Date.UTC(t.year, t.month - 1, t.day);
  const z = t.zone;
  if (!z || z.tzid === "floating" || (z.tzid !== "UTC" && !ICAL.TimezoneService.has(z.tzid))) {
    const x = t.clone(); x.zone = paris(); return x.toUnixTime() * 1000;
  }
  return t.toJSDate().getTime();
}

/** Événements d'un fichier iCal compris entre debut et fin (ms), récurrences et exceptions comprises. */
export function lireIcs(texte: string, debut: number, fin: number, agenda = "Agenda", n = 0): Evenement[] {
  paris();
  const comp = new ICAL.Component(ICAL.parse(texte));
  for (const tz of comp.getAllSubcomponents("vtimezone")) {
    try { ICAL.TimezoneService.register(tz); } catch { /* déjà connu */ }
  }
  const evs = comp.getAllSubcomponents("vevent").map((v) => new ICAL.Event(v));
  const exceptions = evs.filter((e) => e.isRecurrenceException());
  const res: Evenement[] = [];
  const ajouter = (uid: string, titre: string, lieu: string, d: ICAL.Time, f: ICAL.Time | null, statut: string) => {
    if (statut === "CANCELLED") return;
    const journee = d.isDate;
    const a = ms(d);
    let b = f ? ms(f) : a + (journee ? 86400_000 : 0);
    if (b < a) b = a;
    if (b > debut && a < fin || (a === b && a >= debut && a < fin)) res.push({ id: uid + "@" + a, titre: titre || "(sans titre)", debut: a, fin: b, journee, lieu, agenda, n });
  };
  for (const e of evs) {
    if (e.isRecurrenceException()) continue;
    const statut = String(e.component.getFirstPropertyValue("status") ?? "");
    if (!e.isRecurring()) { ajouter(e.uid, e.summary, e.location ?? "", e.startDate, e.endDate, statut); continue; }
    for (const x of exceptions) if (x.uid === e.uid) e.relateException(x);
    const it = e.iterator();
    for (let i = 0, t = it.next(); t && i < MAX_OCC; t = it.next(), i++) {
      const a = ms(t);
      if (a >= fin) break;
      const o = e.getOccurrenceDetails(t);
      const st = String(o.item.component.getFirstPropertyValue("status") ?? statut);
      if (ms(o.endDate) <= debut && a < debut) continue;
      ajouter(e.uid, o.item.summary, o.item.location ?? "", o.startDate, o.endDate, st);
    }
  }
  return res;
}

let cache: { t: number; cle: string; textes: { s: Source; texte?: string; erreur?: string }[] } | null = null;

async function telecharger(f: typeof fetch = fetch) {
  const ss = sources();
  const cle = ss.map((s) => s.url).join(" ");
  if (cache && cache.cle === cle && Date.now() - cache.t < 5 * 60_000) return cache.textes;
  const textes = await Promise.all(ss.map(async (s) => {
    try {
      const r = await f(s.url, { signal: AbortSignal.timeout(10_000), cache: "no-store", headers: { "User-Agent": "hm-pro" } });
      if (!r.ok) return { s, erreur: `${s.nom} : erreur ${r.status} (adresse changée ?)` };
      return { s, texte: await r.text() };
    } catch { return { s, erreur: `${s.nom} : injoignable` }; }
  }));
  cache = { t: Date.now(), cle, textes };
  return textes;
}

export function viderCacheAgenda() { cache = null; }

/** Tous les agendas configurés, triés. erreurs : agendas illisibles (le reste s'affiche quand même). */
export async function evenements(debut: number, fin: number, f?: typeof fetch): Promise<{ evenements: Evenement[]; erreurs: string[]; regle: boolean }> {
  const textes = await telecharger(f);
  const erreurs: string[] = [];
  const evenements: Evenement[] = [];
  textes.forEach(({ s, texte, erreur }, i) => {
    if (erreur) { erreurs.push(erreur); return; }
    try { evenements.push(...lireIcs(texte!, debut, fin, s.nom, i)); } catch { erreurs.push(`${s.nom} : fichier illisible`); }
  });
  evenements.sort((a, b) => jourParis(a.debut).localeCompare(jourParis(b.debut)) || Number(b.journee) - Number(a.journee) || a.debut - b.debut);
  return { evenements, erreurs, regle: textes.length > 0 };
}

export const jourParis = (ms: number) => new Date(ms).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
export const heureParis = (ms: number) => new Date(ms).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
