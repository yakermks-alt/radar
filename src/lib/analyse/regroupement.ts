// Regroupement des plaintes de même sens et score des groupes. Fonctions pures, testées.

// Détection de communautés (même principe que sentence-transformers) : on prend le point qui a le plus
// de voisins au-dessus du seuil de similarité, on en fait un groupe avec ses voisins encore libres,
// puis on recommence. Les points isolés restent hors groupe. Les vecteurs doivent être normalisés.
export function communautes(vecteurs: number[][], seuil: number, tailleMin: number): number[][] {
  const n = vecteurs.length;
  if (n === 0) return [];
  const d = vecteurs[0].length;
  const plat = new Float32Array(n * d);
  vecteurs.forEach((v, i) => plat.set(v, i * d));

  const voisins: number[][] = Array.from({ length: n }, (_, i) => [i]);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let s = 0;
      for (let k = 0, a = i * d, b = j * d; k < d; k++) s += plat[a + k] * plat[b + k];
      if (s >= seuil) {
        voisins[i].push(j);
        voisins[j].push(i);
      }
    }
  }

  const ordre = [...voisins.keys()].sort((a, b) => voisins[b].length - voisins[a].length || a - b);
  const pris = new Uint8Array(n);
  const groupes: number[][] = [];
  for (const i of ordre) {
    if (pris[i] || voisins[i].length < tailleMin) continue;
    const membres = voisins[i].filter((j) => !pris[j]);
    if (membres.length < tailleMin) continue;
    for (const j of membres) pris[j] = 1;
    groupes.push(membres);
  }
  return groupes;
}

// Centre normalisé d'un groupe et distance (1 - similarité) de chaque membre à ce centre.
export function centre(vecteurs: number[][], membres: number[]): { centre: number[]; distances: number[] } {
  const d = vecteurs[membres[0]].length;
  const c = new Array<number>(d).fill(0);
  for (const m of membres) for (let k = 0; k < d; k++) c[k] += vecteurs[m][k];
  const norme = Math.hypot(...c) || 1;
  const centreNorme = c.map((x) => x / norme);
  const distances = membres.map((m) => 1 - vecteurs[m].reduce((s, x, k) => s + x * centreNorme[k], 0));
  return { centre: centreNorme, distances };
}

export type Indicateurs = {
  nbAvis: number;
  nbApps: number;
  partPaiement: number; // 0 à 1
  graviteMoyenne: number; // 1 à 3
  partBesoin: number; // 0 à 1 : besoin, prix ou support (plutôt qu'un simple bug)
  faisabilite: number; // 0 à 10, estimée par l'IA
};

// Poids du score sur 10. Un problème vaut plus s'il est fréquent, partagé par plusieurs applis
// (donc pas le bug d'un seul éditeur), grave, lié à de l'argent déjà dépensé, et faisable.
export const POIDS = { volume: 0.2, diversite: 0.2, paiement: 0.15, gravite: 0.15, besoin: 0.1, faisabilite: 0.2 } as const;

const borne = (x: number) => Math.min(10, Math.max(0, x));
const arrondi = (x: number) => Math.round(x * 100) / 100;

export function scorer(i: Indicateurs): { score: number; detail: Record<keyof typeof POIDS, number> } {
  const detail = {
    volume: borne((10 * Math.log10(Math.max(1, i.nbAvis))) / Math.log10(200)), // 200 avis = 10
    diversite: borne((i.nbApps - 1) * 2.5), // 1 appli = 0, 5 applis = 10
    paiement: borne(i.partPaiement * 20), // la moitié des avis = 10
    gravite: borne((i.graviteMoyenne - 1) * 5),
    besoin: borne(i.partBesoin * 10),
    faisabilite: borne(i.faisabilite),
  };
  const score = (Object.keys(POIDS) as (keyof typeof POIDS)[]).reduce((s, k) => s + detail[k] * POIDS[k], 0);
  return {
    score: arrondi(score),
    detail: Object.fromEntries(Object.entries(detail).map(([k, v]) => [k, arrondi(v)])) as Record<keyof typeof POIDS, number>,
  };
}
