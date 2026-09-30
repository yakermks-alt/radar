import { describe, expect, it } from "vitest";
import { chercherEntreprises, pageAvis, rechercherWeb } from "../../src/lib/agent/outils";

const json = (corps: unknown, status = 200) => (async () => new Response(JSON.stringify(corps), { status })) as typeof fetch;

describe("chercherEntreprises", () => {
  it("résume les sociétés et écarte les entrepreneurs individuels (donnée personnelle)", async () => {
    const f = json({
      results: [
        {
          siren: "123456789", nom_complet: "BOULANGEPRO", activite_principale: "58.29C", date_creation: "2015-03-01",
          tranche_effectif_salarie: "11", nombre_etablissements_ouverts: 1, finances: { "2023": { ca: 800000, resultat_net: 50000 }, "2024": { ca: 1200000, resultat_net: 90000 } },
        },
        { siren: "987654321", nom_complet: "JEAN DUPONT", complements: { est_entrepreneur_individuel: true } },
      ],
    });
    const r = await chercherEntreprises("boulangepro", f);
    expect(r).toHaveLength(1);
    expect(r[0].url).toBe("https://annuaire-entreprises.data.gouv.fr/entreprise/123456789");
    expect(r[0].texte).toContain("Effectif : 10 à 19 salariés");
    expect(r[0].texte).toContain("Chiffre d'affaires 2024 : 1");
  });
});

describe("rechercherWeb", () => {
  it("refuse de chercher sans clé", async () => {
    await expect(rechercherWeb("x", undefined)).rejects.toThrow(/TAVILY_API_KEY/);
  });
  it("ne garde que les liens web", async () => {
    const f = json({ results: [{ title: "A", url: "https://a.fr", content: "prix" }, { title: "B", url: "javascript:alert(1)", content: "" }] });
    expect(await rechercherWeb("x", "cle", f)).toEqual([{ titre: "A", url: "https://a.fr", extrait: "prix" }]);
  });
  it("signale un quota épuisé", async () => {
    await expect(rechercherWeb("x", "cle", json({}, 432))).rejects.toThrow(/Quota/);
  });
});

describe("pages d'avis de logiciels (Trustpilot, Capterra…)", () => {
  it("reconnaît les sites d'avis, pas les autres ni les imitations", () => {
    expect(pageAvis("https://fr.trustpilot.com/review/zelty.fr")).toBe(true);
    expect(pageAvis("https://www.capterra.fr/reviews/190836/pennylane")).toBe(true);
    expect(pageAvis("https://www.g2.com/products/pennylane/reviews")).toBe(true);
    expect(pageAvis("https://trustpilot.com.pirate.fr/review/x")).toBe(false);
    expect(pageAvis("https://www.pennylane.com/fr/tarifs")).toBe(false);
    expect(pageAvis("pas une adresse")).toBe(false);
  });

  it("garde le texte complet des seules pages d'avis", async () => {
    const f = (async () =>
      new Response(
        JSON.stringify({
          results: [
            { title: "Zelty avis", url: "https://fr.trustpilot.com/review/zelty.fr", content: "extrait", raw_content: "Avis complet : la caisse plante le samedi soir." },
            { title: "Zelty tarifs", url: "https://www.zelty.fr/tarifs", content: "Offre à 69 €", raw_content: "page entière du site de l'éditeur" },
          ],
        }),
      )) as unknown as typeof fetch;
    const r = await rechercherWeb("avis zelty", "cle", f);
    expect(r[0].complet).toBe("Avis complet : la caisse plante le samedi soir.");
    expect(r[1].complet).toBeUndefined(); // les autres pages se lisent avec lire_page, protections comprises
  });
});
