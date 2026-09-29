import { describe, expect, it } from "vitest";
import { chiffresProuves, nombres, nomsPropres, nomsProuves, verifierAffirmations } from "../../src/lib/agent/citations";

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

describe("chiffres prouvés par la citation", () => {
  it("met les nombres sous une forme comparable", () => {
    expect([...nombres("40 561 entreprises, 9,00 €/mois, 1,5 %, 1.500 clients, 2026")].sort()).toEqual(["1.5", "1500", "2026", "40561", "9"]);
    expect([...nombres("40 561")]).toEqual(["40561"]);
  });
  it("accepte des chiffres présents dans la citation, quelle que soit leur écriture", () => {
    expect(chiffresProuves("Il existe 40561 entreprises.", "Au 29/09, 40 561 entreprises actives")).toBe(true);
    expect(chiffresProuves("L'offre Pro coûte 9 € par mois.", "Pro : 9,00 €/mois HT")).toBe(true);
  });
  it("refuse un chiffre absent de la citation", () => {
    expect(chiffresProuves("Tiime compte 500 000 utilisateurs.", "450 000 entrepreneurs adorent Tiime")).toBe(false);
    expect(chiffresProuves("L'offre coûte 19 € depuis 2024.", "L'offre coûte 19 € par mois.")).toBe(false);
  });
  it("rejette l'affirmation avec la raison « chiffre non prouvé »", () => {
    const src = new Map([["https://tiime.fr", "450 000 entrepreneurs adorent Tiime et son application."]]);
    const { rejetees } = verifierAffirmations([{ texte: "Tiime a 500 000 utilisateurs.", source: "https://tiime.fr", citation: "450 000 entrepreneurs adorent Tiime" }], src);
    expect(rejetees[0].raison).toBe("chiffre non prouvé");
  });
});

describe("noms prouvés par la citation ou la source", () => {
  it("repère les noms d'entreprises et de produits, pas les mots courants", () => {
    expect(nomsPropres("Un utilisateur d'HubSpot signale que l'application plante.")).toEqual(["HubSpot"]);
    expect(nomsPropres("Selon Combien ça coûte, SumUp propose un logiciel gratuit en France.")).toEqual(["Combien", "SumUp"]);
    expect(nomsPropres("Le plan Business de Badger Maps coûte 58 dollars HT.")).toEqual(["Business", "Badger", "Maps"]);
  });
  it("accepte un nom présent dans la citation, le titre ou l'adresse", () => {
    expect(nomsProuves("Un utilisateur d'Indy signale un bug.", "ça plante", "Avis 1/5 sur Indy : comptabilité", "radar://avis/1")).toBe(true);
    expect(nomsProuves("D'après Codeur.com, ONexpense coûte 3,40 €.", "ONexpense est accessible dès 3,40€", "Meilleurs logiciels", "https://www.codeur.com/blog/x")).toBe(true);
    expect(nomsProuves("VEGA propose une offre à 45 €.", "Vega affiche une offre", null, "https://x.fr")).toBe(true);
  });
  it("refuse un nom que rien ne prouve", () => {
    expect(nomsProuves("SumUp propose un logiciel gratuit.", "Le logiciel est gratuit mais présente des frais", "Combien ça coûte un logiciel de caisse ?", "https://pro.orange.fr/lemag/x")).toBe(false);
    expect(nomsProuves("Le plan Business coûte 58 $.", "$58/mo Per user", "Pricing - Badger Maps", "https://www.badgermapping.com/pricing")).toBe(false);
  });
  it("rejette avec la raison « nom non prouvé » quand les titres sont fournis", () => {
    const src = new Map([["https://pro.orange.fr/x", "Le logiciel est gratuit mais présente des frais de transaction plus élevés."]]);
    const a = [{ texte: "SumUp propose un logiciel gratuit.", source: "https://pro.orange.fr/x", citation: "Le logiciel est gratuit mais présente des frais" }];
    expect(verifierAffirmations(a, src, new Map([["https://pro.orange.fr/x", "Combien ça coûte ?"]])).rejetees[0].raison).toBe("nom non prouvé");
    expect(verifierAffirmations(a, src).gardees).toHaveLength(1); // sans titres : contrôle sauté
  });
});
