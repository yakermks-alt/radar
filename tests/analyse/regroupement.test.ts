import { describe, expect, it } from "vitest";
import { nettoyerVerdicts, type Verdict } from "../../src/lib/analyse/extraction";
import { centre, communautes, fusionner, POIDS, scorer } from "../../src/lib/analyse/regroupement";

// Vecteur normalisé proche d'un axe, avec un petit décalage pour varier les points.
const autour = (axe: number, bruit: number, d = 8) => {
  const v = Array.from({ length: d }, (_, k) => (k === axe ? 1 : k === (axe + 1) % d ? bruit : 0));
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
};

describe("communautes", () => {
  it("sépare deux thèmes et laisse de côté les points isolés", () => {
    const v = [autour(0, 0), autour(0, 0.1), autour(0, 0.2), autour(3, 0), autour(3, 0.1), autour(3, 0.15), autour(6, 0)];
    const g = communautes(v, 0.9, 2).map((m) => [...m].sort());
    expect(g).toHaveLength(2);
    expect(g).toContainEqual([0, 1, 2]);
    expect(g).toContainEqual([3, 4, 5]);
  });

  it("n'assigne jamais un point à deux groupes", () => {
    const v = Array.from({ length: 30 }, (_, i) => autour(i % 3, (i % 5) / 10));
    const tous = communautes(v, 0.8, 2).flat();
    expect(new Set(tous).size).toBe(tous.length);
  });

  it("respecte la taille minimale", () => {
    const v = [autour(0, 0), autour(0, 0.1), autour(4, 0)];
    expect(communautes(v, 0.9, 3)).toEqual([]);
  });

  it("gère une liste vide", () => {
    expect(communautes([], 0.9, 2)).toEqual([]);
  });
});

describe("centre", () => {
  it("renvoie un centre normalisé et des distances faibles pour des points proches", () => {
    const v = [autour(0, 0), autour(0, 0.1)];
    const { centre: c, distances } = centre(v, [0, 1]);
    expect(Math.hypot(...c)).toBeCloseTo(1, 6);
    for (const d of distances) expect(d).toBeLessThan(0.01);
  });
});

describe("scorer", () => {
  const base = { nbAvis: 200, nbApps: 5, partPaiement: 0.5, graviteMoyenne: 3, partBesoin: 1, faisabilite: 10 };

  it("donne 10 au cas idéal et 0 au pire", () => {
    expect(scorer(base).score).toBe(10);
    expect(scorer({ nbAvis: 1, nbApps: 1, partPaiement: 0, graviteMoyenne: 1, partBesoin: 0, faisabilite: 0 }).score).toBe(0);
  });

  it("borne chaque critère entre 0 et 10", () => {
    const { detail } = scorer({ ...base, nbAvis: 10_000, nbApps: 50, partPaiement: 1, faisabilite: 42, marche: 99 });
    for (const v of Object.values(detail)) expect(v).toBeLessThanOrEqual(10);
  });

  it("valorise un problème partagé par plusieurs applis", () => {
    expect(scorer({ ...base, nbApps: 4 }).score).toBeGreaterThan(scorer({ ...base, nbApps: 1 }).score);
  });

  it("fait chuter un problème impossible à résoudre seul, même très fort ailleurs", () => {
    expect(scorer({ ...base, faisabilite: 0 }).score).toBe(2);
    expect(scorer({ ...base, faisabilite: 1 }).score).toBeLessThan(scorer({ ...base, nbAvis: 10, faisabilite: 6 }).score);
  });

  it("réduit une plainte dispersée entre secteurs", () => {
    expect(scorer({ ...base, concentration: 1 }).score).toBe(10);
    expect(scorer({ ...base, concentration: 0 }).score).toBe(6);
    expect(scorer({ ...base, concentration: 0.5 }).score).toBe(8);
  });

  it("tient compte de la taille du marché, et l'ignore quand elle est inconnue", () => {
    expect(scorer({ ...base, marche: 10 }).score).toBe(10);
    expect(scorer({ ...base, marche: null }).score).toBe(10); // poids réparti sur les autres critères
    expect(scorer({ ...base, marche: 0 }).score).toBe(8);
    expect(scorer({ ...base, marche: 0 }).detail.marche).toBe(0);
    expect(scorer(base).detail.marche).toBeNull();
  });

  it("a des poids qui font 1", () => {
    expect(Object.values(POIDS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
});

describe("fusionner", () => {
  it("fusionne deux groupes au même centre et garde les autres", () => {
    const v = [autour(0, 0), autour(0, 0.05), autour(0, 0.1), autour(0, 0.12), autour(4, 0), autour(4, 0.1)];
    const r = fusionner(v, [[0, 1], [2, 3], [4, 5]], 0.95).map((g) => [...g].sort());
    expect(r).toHaveLength(2);
    expect(r).toContainEqual([0, 1, 2, 3]);
    expect(r).toContainEqual([4, 5]);
  });

  it("ne fusionne rien sous le seuil", () => {
    const v = [autour(0, 0), autour(4, 0)];
    expect(fusionner(v, [[0], [1]], 0.9)).toEqual([[0], [1]]);
  });
});

describe("nettoyerVerdicts", () => {
  const v = (id: number, extra: Partial<Verdict> = {}): Verdict => ({
    id,
    categorie: "besoin",
    probleme: "Export PDF impossible",
    type_client: null,
    gravite: 2,
    signal_paiement: false,
    ...extra,
  });

  it("ignore les ids inconnus et les doublons", () => {
    const r = nettoyerVerdicts([{ id: 1 }, { id: 2 }], [v(1), v(1), v(3), v(2)]);
    expect(r.map((x) => x.id)).toEqual([1, 2]);
  });

  it("passe en « autre » une plainte sans problème exploitable", () => {
    const [r] = nettoyerVerdicts([{ id: 1 }], [v(1, { probleme: "  " })]);
    expect(r).toMatchObject({ categorie: "autre", probleme: null });
  });

  it("efface le problème des avis « autre »", () => {
    const [r] = nettoyerVerdicts([{ id: 1 }], [v(1, { categorie: "autre", probleme: "x" })]);
    expect(r.probleme).toBeNull();
  });
});
