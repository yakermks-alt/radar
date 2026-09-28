import { describe, expect, it } from "vitest";
import { creerCompteur, noteMarche, requeteSirene } from "../../src/lib/marche/sirene";

describe("requeteSirene", () => {
  it("cherche les entreprises actives du code NAF", () => {
    const url = decodeURIComponent(requeteSirene("49.32Z"));
    expect(url).toContain("activitePrincipaleUniteLegale:49.32Z");
    expect(url).toContain("etatAdministratifUniteLegale:A");
    expect(url.startsWith("https://api.insee.fr/")).toBe(true);
  });

  it("refuse un code mal formé (pas d'injection dans la requête)", () => {
    expect(() => requeteSirene("49.32Z) OR (x")).toThrow();
    expect(() => requeteSirene("4932Z")).toThrow();
  });
});

describe("creerCompteur", () => {
  it("renvoie null sans clé ou avec un code invalide, sans appel réseau", async () => {
    expect(await creerCompteur(undefined)("49.32Z")).toBeNull();
    expect(await creerCompteur("cle")("n'importe quoi")).toBeNull();
  });
});

describe("noteMarche", () => {
  it("suit une échelle logarithmique bornée", () => {
    expect(noteMarche(100)).toBe(0);
    expect(noteMarche(100_000)).toBe(10);
    expect(noteMarche(10_000)).toBeCloseTo(6.67, 1);
    expect(noteMarche(5_000_000)).toBe(10);
    expect(noteMarche(0)).toBe(0);
    expect(noteMarche(null)).toBeNull();
  });
});
