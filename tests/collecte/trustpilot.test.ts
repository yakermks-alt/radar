import { describe, expect, it } from "vitest";
import { decouperTrustpilot, domaineTrustpilot } from "../../src/lib/collecte/trustpilot";

// Page factice au format du texte renvoyé par la recherche (contenu inventé).
const PAGE = `[Autre ### Caisse Exemple ![Image 3: Rated 2 out of 5 stars](https://cdn.trustpilot.net/stars-2.svg) 2 (10)](https://www.trustpilot.com/review/autre.fr)

# Caisse Exemple Reviews

13

[Jean Dupont FR•2 reviews](https://www.trustpilot.com/users/aaaaaaaaaaaaaaaaaaaaaaaa)

Nov 21, 2025

![Image 22: Rated 1 out of 5 stars](https://cdn.trustpilot.net/stars-1.svg)

## [Support injoignable](https://www.trustpilot.com/reviews/692059a860d8aa5f8092ce27)
La caisse plante le samedi soir.  
Personne ne répond au support.

November 21, 2025

Unprompted review

[Marie Martin FR•1 review](https://www.trustpilot.com/users/bbbbbbbbbbbbbbbbbbbbbbbb)

![Image 24: Rated 5 out of 5 stars](https://cdn.trustpilot.net/stars-5.svg)

## [Très bien](https://www.trustpilot.com/reviews/691c92dcfb7844ebe38e192f)
Rien à redire.

November 18, 2025

Unprompted review
`;

describe("decouperTrustpilot", () => {
  it("découpe la page en avis avec note, titre, texte et date", () => {
    const { nomEntreprise, avis } = decouperTrustpilot(PAGE);
    expect(nomEntreprise).toBe("Caisse Exemple");
    expect(avis).toEqual([
      { id: "692059a860d8aa5f8092ce27", note: 1, titre: "Support injoignable", contenu: "La caisse plante le samedi soir.\nPersonne ne répond au support.", date: "2025-11-21T12:00:00.000Z" },
      { id: "691c92dcfb7844ebe38e192f", note: 5, titre: "Très bien", contenu: "Rien à redire.", date: "2025-11-18T12:00:00.000Z" },
    ]);
  });

  it("ne garde jamais le nom des auteurs", () => {
    expect(JSON.stringify(decouperTrustpilot(PAGE).avis)).not.toMatch(/Dupont|Martin/);
  });

  it("ignore une page sans avis", () => {
    expect(decouperTrustpilot("# Rien Reviews\n\naucun avis").avis).toEqual([]);
  });
});

describe("domaineTrustpilot", () => {
  it("reconnaît une fiche d'entreprise, pas le reste", () => {
    expect(domaineTrustpilot("https://fr.trustpilot.com/review/zelty.fr")).toBe("zelty.fr");
    expect(domaineTrustpilot("https://www.trustpilot.com/review/www.jdc.fr?page=2")).toBe("www.jdc.fr");
    expect(domaineTrustpilot("https://www.trustpilot.com/categories/software_vendor")).toBeNull();
    expect(domaineTrustpilot("https://trustpilot.com.pirate.fr/review/zelty.fr")).toBeNull();
  });
});
