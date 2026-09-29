import { describe, expect, it } from "vitest";
import type { Rapport } from "../../src/lib/agent/agent";
import { concurrent, entreprisesInsee, fiabilite, memeTaxe, prixConcurrents, taxe } from "../../src/lib/rapport/lecture";

const aff = (texte: string, citation: string, source = "https://www.medicalib.fr/blog/x") => ({ texte, citation, source });

const rapport: Rapport = {
  verdict: "prometteur",
  sections: [
    { titre: "Problème", affirmations: [] },
    {
      titre: "Concurrents et prix",
      affirmations: [
        aff("Agathe YOU est proposé à partir de 129 € TTC par mois.", "Agathe YOU est proposé à partir de 129 € TTC/mois"),
        aff("Vega propose une offre IDEL à partir de 45 € par mois.", "VEGA affiche une offre IDEL à partir de 45 €/mois"),
        aff("Selon Codeur.com, Evoliz propose des offres à 32 € HT.", "offres à 32€ HT", "https://www.codeur.com/blog/x"),
        aff("Badger Maps coûte 58 dollars par mois.", "$58/mo"),
        aff("Des éditeurs proposent une version gratuite.", "une version gratuite"),
      ],
    },
    {
      titre: "Taille du marché",
      affirmations: [
        aff("149 073 entreprises ont le code NAF 86.90D.", "Au 2026-09-29, 149 073 entreprises actives en France ont pour activité principale le code NAF 86.90D (répertoire Sirene de l'Insee).", "https://www.insee.fr/fr/metadonnees/nafr2/sousClasse/86.90D"),
      ],
    },
    { titre: "Angle d'attaque", affirmations: [] },
    { titre: "Risques", affirmations: [] },
  ],
  rejetees: [
    { texte: "x", source: "y", citation: "z", raison: "nom non prouvé" },
    { texte: "x", source: "y", citation: "z", raison: "nom non prouvé" },
    { texte: "x", source: "y", citation: "z", raison: "citation hors sujet" },
  ],
  sources: [],
};

describe("prixConcurrents", () => {
  it("lit le concurrent, le prix et HT ou TTC, du moins cher au plus cher", () => {
    expect(prixConcurrents(rapport)).toEqual([
      { nom: "Evoliz", prix: 32, taxe: "HT", source: "https://www.codeur.com/blog/x" },
      { nom: "Vega", prix: 45, taxe: null, source: "https://www.medicalib.fr/blog/x" },
      { nom: "Agathe YOU", prix: 129, taxe: "TTC", source: "https://www.medicalib.fr/blog/x" },
    ]);
  });
  it("écarte les prix en dollars et les affirmations sans prix ni nom", () => {
    expect(prixConcurrents(rapport).map((p) => p.nom)).not.toContain("Badger Maps");
  });
  it("ne compare pas HT et TTC comme si c'était pareil", () => {
    expect(memeTaxe(prixConcurrents(rapport))).toBe(false);
    expect(memeTaxe([{ nom: "a", prix: 1, taxe: "HT", source: "" }, { nom: "b", prix: 2, taxe: "HT", source: "" }])).toBe(true);
  });
});

describe("concurrent", () => {
  it("ignore la source citée en « Selon … »", () => {
    expect(concurrent(aff("Selon Codeur.com, ONexpense coûte 3,40 €.", "x", "https://www.codeur.com/y"))).toBe("ONexpense");
  });
  it("garde les noms en plusieurs mots", () => {
    expect(concurrent(aff("Albus Latitude est proposé à 99 € TTC.", "x"))).toBe("Albus Latitude");
  });
});

describe("taxe", () => {
  it.each([["129 € TTC", "TTC"], ["9,00 € HT", "HT"], ["prix hors taxe", "HT"], ["19 € par mois", null]])("%s → %s", (t, attendu) => expect(taxe(t)).toBe(attendu));
});

describe("entreprisesInsee", () => {
  it("lit le nombre d'entreprises compté par l'Insee", () => expect(entreprisesInsee(rapport)).toBe(149073));
});

describe("fiabilite", () => {
  it("compte les preuves gardées et retirées, par raison", () => {
    expect(fiabilite(rapport)).toEqual({ gardees: 6, retirees: 3, parRaison: { "nom non prouvé": 2, "citation hors sujet": 1 } });
  });
});

describe("prix annuels", () => {
  it("ramène un prix annuel au mois et garde le montant annuel", () => {
    const r: Rapport = { ...rapport, sections: rapport.sections.map((s) => (s.titre === "Concurrents et prix" ? { ...s, affirmations: [aff("Planity Pro coûte 708 euros par an.", "Planity Pro : 708€ annuels")] } : s)) };
    expect(prixConcurrents(r)).toEqual([{ nom: "Planity Pro", prix: 59, taxe: null, source: "https://www.medicalib.fr/blog/x", annuel: 708 }]);
  });
});
