import { describe, expect, it } from "vitest";
import { verifierAffirmations } from "../../src/lib/agent/citations";

const sources = new Map([
  ["https://exemple.fr/prix", "L’offre Pro coûte 19 € par mois,\n  sans engagement. L'offre Équipe coûte 49 €."],
  ["radar://avis/12", "Impossible de faire un avoir depuis l'appli, je dois passer par l'ordinateur."],
]);

describe("verifierAffirmations", () => {
  it("garde une citation exacte, malgré les différences d'espaces, de casse et d'apostrophes", () => {
    const { gardees, rejetees } = verifierAffirmations(
      [
        { texte: "L'offre Pro est à 19 €/mois.", source: "https://exemple.fr/prix", citation: "l'offre pro coûte 19 € par mois, sans engagement" },
        { texte: "Pas d'avoir sur mobile.", source: "radar://avis/12", citation: "« Impossible de faire un avoir depuis l’appli »".replace(/[«»]/g, '"') },
      ],
      sources,
    );
    expect(rejetees).toEqual([]);
    expect(gardees).toHaveLength(2);
  });

  it("rejette une citation reformulée ou inventée", () => {
    const { gardees, rejetees } = verifierAffirmations(
      [{ texte: "L'offre Pro est à 15 €.", source: "https://exemple.fr/prix", citation: "L'offre Pro coûte 15 € par mois" }],
      sources,
    );
    expect(gardees).toEqual([]);
    expect(rejetees[0].raison).toBe("citation introuvable");
  });

  it("rejette une source que l'agent n'a pas lue", () => {
    const { rejetees } = verifierAffirmations([{ texte: "x", source: "https://inconnu.fr", citation: "L’offre Pro coûte 19 € par mois" }], sources);
    expect(rejetees[0].raison).toBe("source inconnue");
  });

  it("rejette une citation trop courte pour prouver quoi que ce soit", () => {
    const { rejetees } = verifierAffirmations([{ texte: "C'est cher.", source: "https://exemple.fr/prix", citation: "coûte" }], sources);
    expect(rejetees[0].raison).toBe("citation trop courte");
  });
});

describe("tolérance sur la forme, jamais sur les mots", () => {
  const liste = new Map([["https://abby.fr/tarifs", "100% gratuit, sans engagement\nFacturation électronique\nDevis & factures illimités\nPro : 9,00 €/mois HT, puis 15 € après la promotion."]]);
  const v = (citation: string) => verifierAffirmations([{ texte: "x", source: "https://abby.fr/tarifs", citation }], liste);

  it("accepte une liste à puces recopiée avec des virgules", () => {
    expect(v("100% gratuit, sans engagement, Facturation électronique, Devis & factures illimités").gardees).toHaveLength(1);
  });
  it("accepte un passage sauté avec « … » si chaque morceau est exact et dans l'ordre", () => {
    expect(v("100% gratuit, sans engagement … Pro : 9,00 €/mois HT").gardees).toHaveLength(1);
    expect(v("Pro : 9,00 €/mois HT […] 100% gratuit, sans engagement").rejetees[0].raison).toBe("citation introuvable");
  });
  it("refuse un chiffre changé, même d'un seul caractère", () => {
    expect(v("Pro : 9,00 €/mois HT, puis 150 € après").rejetees).toHaveLength(1);
    expect(v("Pro : 9,50 €/mois HT, puis 15 € après").rejetees).toHaveLength(1);
  });
  it("refuse un morceau trop court après « … »", () => {
    expect(v("100% gratuit, sans engagement … Pro").rejetees[0].raison).toBe("citation trop courte");
  });
});
