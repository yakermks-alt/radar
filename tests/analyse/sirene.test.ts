import { describe, expect, it } from "vitest";
import { creerCompteur, estNaf2025, noteMarche, requeteSirene, versNaf2025 } from "../../src/lib/marche/sirene";

describe("requeteSirene", () => {
  it("cherche les entreprises actives du code NAF", () => {
    const url = decodeURIComponent(requeteSirene("49.32Z"));
    expect(url).toContain("activitePrincipaleUniteLegale:49.32Z");
    expect(url).toContain("etatAdministratifUniteLegale:A");
    expect(url.startsWith("https://api.insee.fr/")).toBe(true);
  });

  it("compte à la date du jour, pas sur tout l'historique", () => {
    expect(new URL(requeteSirene("10.71C", "2026-09-29")).searchParams.get("date")).toBe("2026-09-29");
    expect(new URL(requeteSirene("10.71C")).searchParams.get("date")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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

describe("passage à la NAF 2025 (5 janvier 2027)", () => {
  it("convertit un code rév. 2 avec la table officielle de l'Insee", () => {
    expect(versNaf2025("86.90D")).toEqual({ codes: ["86.94G", "86.94H"], approche: false }); // éclaté, codes exclusifs
    expect(versNaf2025("43.22A")).toEqual({ codes: ["43.22G"], approche: false });
    expect(versNaf2025("10.71C")).toEqual({ codes: ["10.71H"], approche: true }); // regroupé avec un autre code
    expect(versNaf2025("47.11C")).toBeNull(); // parts de codes partagés : rien d'attribuable
    expect(versNaf2025("99.99Z")).toBeNull();
  });

  it("garde un code déjà en NAF 2025", () => {
    expect(estNaf2025("86.94G")).toBe(true);
    expect(estNaf2025("86.90D")).toBe(false);
    expect(versNaf2025("86.94G")).toEqual({ codes: ["86.94G"], approche: false });
  });

  it("interroge le bon champ de Sirene selon la date", () => {
    const q = (code: string, jour: string) => new URL(requeteSirene(code, jour)).searchParams.get("q");
    expect(q("86.90D", "2026-09-30")).toBe("periode(activitePrincipaleUniteLegale:86.90D AND etatAdministratifUniteLegale:A)");
    expect(q("86.94G", "2026-09-30")).toBe("activitePrincipaleNAF25UniteLegale:86.94G AND periode(etatAdministratifUniteLegale:A)");
    expect(q("86.94G", "2027-01-05")).toBe("periode(activitePrincipaleUniteLegale:86.94G AND etatAdministratifUniteLegale:A)");
  });

  it("additionne les codes NAF 2025 d'un code rév. 2 après la bascule", async () => {
    const appels: string[] = [];
    const vraiFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      const q = new URL(url).searchParams.get("q") ?? "";
      appels.push(q);
      return new Response(JSON.stringify({ header: { total: q.includes("86.94G") ? 141897 : 4992 } }));
    }) as typeof fetch;
    try {
      const compter = creerCompteur("cle", () => "2027-01-06");
      expect(await compter("86.90D")).toBe(146889);
      expect(appels).toHaveLength(2);
    } finally {
      globalThis.fetch = vraiFetch;
    }
  });
});
