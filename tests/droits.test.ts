import { describe, expect, it } from "vitest";
import { modulesVisibles, niveau, peut } from "@/lib/droits";

describe("droits par onglet", () => {
  const membre = { role: "membre", actif: true };
  it("un membre sans droit ne voit rien", () => {
    expect(modulesVisibles(membre, {})).toEqual([]);
    expect(peut(membre, {}, "licences", "lecture")).toBe(false);
  });
  it("lecture ne permet pas d'écrire", () => {
    const d = { licences: "lecture" as const };
    expect(peut(membre, d, "licences", "lecture")).toBe(true);
    expect(peut(membre, d, "licences", "ecriture")).toBe(false);
    expect(modulesVisibles(membre, d).map((m) => m.code)).toEqual(["licences"]);
  });
  it("écriture inclut la lecture, module par module", () => {
    const d = { concours: "ecriture" as const };
    expect(peut(membre, d, "concours", "lecture")).toBe(true);
    expect(peut(membre, d, "licences", "lecture")).toBe(false);
  });
  it("admin a tout, un compte désactivé n'a rien", () => {
    expect(niveau({ role: "admin" }, {}, "factures")).toBe("ecriture");
    expect(niveau({ role: "admin", actif: false }, {}, "factures")).toBe("aucun");
  });
  it("une valeur inconnue en base vaut aucun", () => {
    expect(niveau(membre, { licences: "tout" as never }, "licences")).toBe("aucun");
  });
});
