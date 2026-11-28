import { describe, expect, it } from "vitest";
import { aujourdhui, centimes, estDate, etat, euros } from "@/lib/montants";

describe("montants et dates (Concours)", () => {
  it("lit les montants saisis à la française", () => {
    expect(centimes("25")).toBe(2500);
    expect(centimes("12,5")).toBe(1250);
    expect(centimes("1 234,56 €")).toBe(123456);
    expect(centimes("-20")).toBe(-2000);
    expect(centimes("0")).toBeNull();
    expect(centimes("12,345")).toBeNull();
    expect(centimes("abc")).toBeNull();
    expect(centimes("200000")).toBeNull();
  });
  it("affiche en euros", () => {
    expect(euros(123456).replace(/\s/g, " ")).toBe("1 234,56 €");
  });
  it("état d'un concours selon le jour à Paris", () => {
    expect(etat("2026-11-28", "2026-11-29", "2026-11-27")).toBe("a_venir");
    expect(etat("2026-11-28", "2026-11-29", "2026-11-29")).toBe("en_cours");
    expect(etat("2026-11-28", "2026-11-29", "2026-11-30")).toBe("termine");
    expect(aujourdhui(new Date("2026-11-27T23:30:00Z"))).toBe("2026-11-28"); // déjà le 28 à Paris
    expect(estDate("28/11/2026")).toBe(false);
  });
});
