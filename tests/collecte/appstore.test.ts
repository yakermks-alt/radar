import { describe, expect, it } from "vitest";
import { empreinteAuteur, lireFluxAvis, lireRecherche, urlAvis, urlRecherche } from "../../src/lib/collecte/appstore";

// Données inventées, au format du flux JSON d'avis de l'App Store.
const entree = (id: string, note: string, contenu: string, extra: Record<string, unknown> = {}) => ({
  id: { label: id },
  author: { name: { label: "Pseudo Test" }, uri: { label: "https://exemple.test" } },
  updated: { label: "2026-09-23T04:00:36-07:00" },
  "im:rating": { label: note },
  "im:version": { label: "5.21.0" },
  title: { label: "  Titre  " },
  content: { label: contenu, attributes: { type: "text" } },
  ...extra,
});

const flux = (entry: unknown, last = 4) => ({
  feed: {
    entry,
    link: [
      { attributes: { rel: "self", href: "https://itunes.apple.com/fr/rss/customerreviews/page=1/id=1/json" } },
      { attributes: { rel: "last", href: `https://itunes.apple.com/fr/rss/customerreviews/page=${last}/id=1/xml` } },
    ],
  },
});

describe("lireFluxAvis", () => {
  it("lit les avis, la date, la version et la dernière page", () => {
    const r = lireFluxAvis(flux([entree("10", "1", "Aucun support"), entree("11", "5", "Parfait")]));
    expect(r.dernierePage).toBe(4);
    expect(r.ignores).toBe(0);
    expect(r.avis).toHaveLength(2);
    expect(r.avis[0]).toMatchObject({
      idExterne: "10",
      note: 1,
      titre: "Titre",
      contenu: "Aucun support",
      versionApp: "5.21.0",
      publieLe: "2026-09-23T11:00:36.000Z",
    });
  });

  it("ne garde jamais le pseudo en clair", () => {
    const [a] = lireFluxAvis(flux([entree("10", "1", "x")])).avis;
    expect(a.auteurEmpreinte).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(a)).not.toContain("Pseudo");
  });

  it("accepte une page à un seul avis (objet au lieu d'une liste)", () => {
    expect(lireFluxAvis(flux(entree("10", "2", "x"))).avis).toHaveLength(1);
  });

  it("accepte une page vide", () => {
    expect(lireFluxAvis({ feed: {} })).toEqual({ avis: [], dernierePage: null, ignores: 0 });
  });

  it("écarte les entrées invalides sans tout rejeter", () => {
    const r = lireFluxAvis(
      flux([entree("1", "0", "note 0"), entree("2", "6", "note 6"), entree("3", "3", "   "), { id: { label: "4" } }, entree("5", "4", "ok")]),
    );
    expect(r.avis.map((a) => a.idExterne)).toEqual(["5"]);
    expect(r.ignores).toBe(4);
  });

  it("tronque les avis trop longs", () => {
    const [a] = lireFluxAvis(flux([entree("1", "1", "a".repeat(20_000))])).avis;
    expect(a.contenu).toHaveLength(10_000);
  });
});

describe("empreinteAuteur", () => {
  it("est stable et insensible à la casse", () => {
    expect(empreinteAuteur("Jean")).toBe(empreinteAuteur(" jean "));
    expect(empreinteAuteur("Jean")).not.toBe(empreinteAuteur("Jeanne"));
  });
  it("renvoie null sans pseudo", () => {
    expect(empreinteAuteur(undefined)).toBeNull();
    expect(empreinteAuteur("  ")).toBeNull();
  });
});

describe("urls", () => {
  it("construit l'url d'une page d'avis", () => {
    expect(urlAvis("123", 2)).toBe("https://itunes.apple.com/fr/rss/customerreviews/page=2/id=123/sortby=mostrecent/json");
  });
  it("refuse un identifiant ou une page invalide", () => {
    expect(() => urlAvis("12/../x", 1)).toThrow();
    expect(() => urlAvis("123", 0)).toThrow();
    expect(() => urlAvis("123", 11)).toThrow();
  });
  it("encode le terme de recherche", () => {
    expect(urlRecherche("devis & facture")).toContain("term=devis+%26+facture");
    expect(urlRecherche("x")).toContain("country=fr");
  });
});

describe("lireRecherche", () => {
  it("lit les applis et nettoie l'url", () => {
    const [a] = lireRecherche({
      results: [
        {
          trackId: 42,
          trackName: "Appli",
          primaryGenreName: "Business",
          userRatingCount: 120,
          trackViewUrl: "https://apps.apple.com/fr/app/x/id42?uo=4",
          description: "Une   description\nsur deux lignes",
        },
      ],
    });
    expect(a).toMatchObject({ storeId: "42", nbNotes: 120, url: "https://apps.apple.com/fr/app/x/id42", description: "Une description sur deux lignes" });
    expect(a.noteMoyenne).toBeNull();
  });
});
