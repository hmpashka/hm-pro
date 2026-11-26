import { describe, expect, it } from "vitest";
import { chiffrer, chiffrerJson, dechiffrer, dechiffrerJson } from "@/lib/chiffrement";

describe("chiffrement des champs sensibles", () => {
  it("aller-retour, jamais deux fois le même résultat", () => {
    const a = chiffrer("client@exemple.fr"), b = chiffrer("client@exemple.fr");
    expect(a).not.toBe(b);
    expect(a).not.toContain("client");
    expect(dechiffrer(a)).toBe("client@exemple.fr");
    expect(dechiffrerJson(chiffrerJson({ x: [1, "é"] }))).toEqual({ x: [1, "é"] });
  });
  it("une valeur modifiée est refusée", () => {
    const a = chiffrer("montant 1200");
    const b = Buffer.from(a.slice(3), "base64");
    b[b.length - 1] ^= 1;
    expect(() => dechiffrer("v1:" + b.toString("base64"))).toThrow();
  });
  it("sans bonne clé : erreur claire", () => {
    const k = process.env.CHIFFREMENT_CLE;
    process.env.CHIFFREMENT_CLE = "court";
    expect(() => chiffrer("x")).toThrow(/32 octets/);
    process.env.CHIFFREMENT_CLE = k;
  });
});
