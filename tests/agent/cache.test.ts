import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { avecCache, cleRecherche, DUREE_CACHE_MS, type Magasin } from "../../src/lib/agent/cache";

function magasinMemoire(depart: Record<string, { contenu: unknown; cree_le: string }> = {}): Magasin & { donnees: typeof depart } {
  const donnees = { ...depart };
  return {
    donnees,
    lire: async (cle) => donnees[cle] ?? null,
    ecrire: async (cle, contenu) => {
      donnees[cle] = { contenu, cree_le: new Date(0).toISOString() };
    },
  };
}

const schema = z.array(z.string());
const maintenant = Date.parse("2026-09-29T12:00:00Z");

describe("avecCache", () => {
  it("réutilise un résultat récent sans refaire l'appel", async () => {
    const m = magasinMemoire({ [cleRecherche("Prix Abby")]: { contenu: ["a"], cree_le: "2026-09-28T12:00:00Z" } });
    const calcul = vi.fn(async () => ["b"]);
    const r = await avecCache(m, cleRecherche("  prix   abby "), schema, calcul, maintenant);
    expect(r).toEqual({ valeur: ["a"], depuisCache: true });
    expect(calcul).not.toHaveBeenCalled();
  });

  it("refait l'appel au-delà de 7 jours et enregistre le nouveau résultat", async () => {
    const vieux = new Date(maintenant - DUREE_CACHE_MS - 1000).toISOString();
    const m = magasinMemoire({ "recherche:x": { contenu: ["vieux"], cree_le: vieux } });
    const r = await avecCache(m, "recherche:x", schema, async () => ["neuf"], maintenant);
    expect(r).toEqual({ valeur: ["neuf"], depuisCache: false });
    expect(m.donnees["recherche:x"].contenu).toEqual(["neuf"]);
  });

  it("ignore un contenu de cache abîmé", async () => {
    const m = magasinMemoire({ "recherche:x": { contenu: { pas: "une liste" }, cree_le: "2026-09-29T11:00:00Z" } });
    expect((await avecCache(m, "recherche:x", schema, async () => ["ok"], maintenant)).depuisCache).toBe(false);
  });

  it("ne bloque jamais l'enquête si le cache est en panne", async () => {
    const panne: Magasin = { lire: async () => { throw new Error("base injoignable"); }, ecrire: async () => { throw new Error("base injoignable"); } };
    expect(await avecCache(panne, "recherche:x", schema, async () => ["ok"], maintenant)).toEqual({ valeur: ["ok"], depuisCache: false });
  });

  it("ne met pas en cache un appel qui échoue", async () => {
    const m = magasinMemoire();
    await expect(avecCache(m, "recherche:x", schema, async () => { throw new Error("Tavily 500"); }, maintenant)).rejects.toThrow("Tavily 500");
    expect(m.donnees).toEqual({});
  });
});
