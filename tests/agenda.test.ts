import { describe, expect, it } from "vitest";
import { evenements, heureParis, jourParis, lireIcs, sources, viderCacheAgenda } from "@/lib/agenda";

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc//Google Calendar 70.9054//EN
BEGIN:VTIMEZONE
TZID:Europe/Paris
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:hebdo@test
DTSTART;TZID=Europe/Paris:20261102T090000
DTEND;TZID=Europe/Paris:20261102T100000
RRULE:FREQ=WEEKLY;COUNT=6
EXDATE;TZID=Europe/Paris:20261116T090000
SUMMARY:Point clinique
LOCATION:Fontainebleau
END:VEVENT
BEGIN:VEVENT
UID:hebdo@test
RECURRENCE-ID;TZID=Europe/Paris:20261123T090000
DTSTART;TZID=Europe/Paris:20261123T140000
DTEND;TZID=Europe/Paris:20261123T150000
SUMMARY:Point clinique (déplacé)
END:VEVENT
BEGIN:VEVENT
UID:journee@test
DTSTART;VALUE=DATE:20261205
DTEND;VALUE=DATE:20261207
SUMMARY:Hunter Deauville
END:VEVENT
BEGIN:VEVENT
UID:annule@test
DTSTART:20261120T100000Z
DTEND:20261120T110000Z
STATUS:CANCELLED
SUMMARY:Annulé
END:VEVENT
BEGIN:VEVENT
UID:ete@test
DTSTART;TZID=Europe/Paris:20260710T080000
DTEND;TZID=Europe/Paris:20260710T090000
SUMMARY:Été
END:VEVENT
END:VCALENDAR`;

const ms = (s: string) => Date.parse(s);

describe("agenda iCal", () => {
  it("adresses : nom facultatif, webcal accepté, http refusé", () => {
    expect(sources("Pro|https://a/b.ics webcal://c/d.ics http://non")).toEqual([
      { nom: "Pro", url: "https://a/b.ics" }, { nom: "Agenda 2", url: "https://c/d.ics" }]);
  });

  it("récurrences, exception déplacée, date exclue, annulé ignoré, heure de Paris", () => {
    const l = lireIcs(ICS, ms("2026-11-01T00:00:00Z"), ms("2026-12-31T00:00:00Z"));
    const points = l.filter((e) => e.titre.startsWith("Point")).sort((a, b) => a.debut - b.debut);
    expect(points.map((e) => jourParis(e.debut) + " " + heureParis(e.debut) + " " + e.titre)).toEqual([
      "2026-11-02 09:00 Point clinique", "2026-11-09 09:00 Point clinique",
      "2026-11-23 14:00 Point clinique (déplacé)", "2026-11-30 09:00 Point clinique", "2026-12-07 09:00 Point clinique"]);
    expect(points[0].lieu).toBe("Fontainebleau");
    expect(l.some((e) => e.titre === "Annulé")).toBe(false);
    const j = l.find((e) => e.titre === "Hunter Deauville")!;
    expect([j.journee, jourParis(j.debut), (j.fin - j.debut) / 86400_000]).toEqual([true, "2026-12-05", 2]);
  });

  it("heure d'été respectée, et rien hors de la période", () => {
    expect(heureParis(lireIcs(ICS, ms("2026-07-01T00:00:00Z"), ms("2026-07-31T00:00:00Z"))[0].debut)).toBe("08:00");
    expect(lireIcs(ICS, ms("2027-01-01T00:00:00Z"), ms("2027-02-01T00:00:00Z"))).toEqual([]);
  });

  it("un agenda injoignable n'empêche pas les autres de s'afficher", async () => {
    viderCacheAgenda();
    process.env.AGENDA_ICS = "Pro|https://ok/a.ics Perso|https://ko/b.ics";
    const f = (async (u: string) => u.includes("ok") ? new Response(ICS) : new Response("", { status: 404 })) as unknown as typeof fetch;
    const r = await evenements(ms("2026-12-01T00:00:00Z"), ms("2026-12-10T00:00:00Z"), f);
    expect(r.evenements.map((e) => e.titre)).toEqual(["Hunter Deauville", "Point clinique"]);
    expect(r.erreurs).toEqual(["Perso : erreur 404 (adresse changée ?)"]);
    delete process.env.AGENDA_ICS;
  });
});

describe("agenda : cas sans fuseau et journées entières", () => {
  it("TZID=Europe/Paris sans VTIMEZONE ou heure flottante : heure de Paris", () => {
    const ics = "BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:a\nSUMMARY:A\nDTSTART;TZID=Europe/Paris:20261130T090000\nDTEND;TZID=Europe/Paris:20261130T100000\nEND:VEVENT\n"
      + "BEGIN:VEVENT\nUID:b\nSUMMARY:B\nDTSTART:20260715T090000\nDTEND:20260715T100000\nEND:VEVENT\nEND:VCALENDAR";
    const l = lireIcs(ics, Date.parse("2026-01-01"), Date.parse("2027-01-01"));
    expect(l.map((e) => e.titre + " " + heureParis(e.debut)).sort()).toEqual(["A 09:00", "B 09:00"]);
  });
  it("une journée entière n'apparaît que sur ses jours", async () => {
    const { joursDe } = await import("@/lib/agenda-hm");
    const ics = "BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:j\nSUMMARY:J\nDTSTART;VALUE=DATE:20261203\nDTEND;VALUE=DATE:20261204\nEND:VEVENT\n"
      + "BEGIN:VEVENT\nUID:k\nSUMMARY:K\nDTSTART;VALUE=DATE:20261205\nDTEND;VALUE=DATE:20261207\nEND:VEVENT\nEND:VCALENDAR";
    const [j, k] = lireIcs(ics, Date.parse("2026-12-01"), Date.parse("2026-12-31")).sort((a, b) => a.debut - b.debut);
    expect(joursDe(j)).toEqual(["2026-12-03"]);
    expect(joursDe(k)).toEqual(["2026-12-05", "2026-12-06"]);
  });
});
