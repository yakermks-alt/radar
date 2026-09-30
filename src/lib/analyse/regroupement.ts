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
  concentration?: number; // 0 à 1 : part des plaintes dans le secteur principal (1 si absent)
  marche?: number | null; // 0 à 10 : taille du marché (nombre d'entreprises), null si inconnue
};

// Potentiel sur 10 : un problème vaut plus s'il est fréquent, partagé par plusieurs applis (donc pas
// le bug d'un seul éditeur), grave, lié à de l'argent déjà dépensé, et un vrai besoin plutôt qu'un bug.
// Taille du marché : nombre réel d'entreprises du métier en France (API Sirene). Quand elle est inconnue,
// son poids est réparti sur les autres critères.
export const POIDS = { volume: 0.2, diversite: 0.2, paiement: 0.15, gravite: 0.15, besoin: 0.1, marche: 0.2 } as const;

// Une plainte universelle (tous secteurs confondus) est rarement une niche à attaquer seul :
// le score est réduit jusqu'à 40 % quand les plaintes sont dispersées entre secteurs.
export const PLANCHER_CONCENTRATION = 0.6;

// La faisabilité multiplie le potentiel au lieu de s'y ajouter : un problème qu'on ne peut pas résoudre
// seul (banque, administration, plateforme dominante) ne doit jamais finir en haut du classement.
export const PLANCHER_FAISABILITE = 0.2;

const borne = (x: number) => Math.min(10, Math.max(0, x));
const arrondi = (x: number) => Math.round(x * 100) / 100;

export type DetailScore = Record<Exclude<keyof typeof POIDS, "marche"> | "faisabilite" | "potentiel" | "concentration", number> & {
  marche: number | null;
};

export function scorer(i: Indicateurs): { score: number; detail: DetailScore } {
  const criteres = {
    volume: borne((10 * Math.log10(Math.max(1, i.nbAvis))) / Math.log10(200)), // 200 avis = 10
    diversite: borne((i.nbApps - 1) * 2.5), // 1 appli = 0, 5 applis = 10
    paiement: borne(i.partPaiement * 20), // la moitié des avis = 10
    gravite: borne((i.graviteMoyenne - 1) * 5),
    besoin: borne(i.partBesoin * 10),
    marche: i.marche === null || i.marche === undefined ? null : borne(i.marche),
  };
  const connus = (Object.keys(POIDS) as (keyof typeof POIDS)[]).filter((k) => criteres[k] !== null);
  const totalPoids = connus.reduce((s, k) => s + POIDS[k], 0);
  const potentiel = connus.reduce((s, k) => s + (criteres[k] as number) * POIDS[k], 0) / totalPoids;
  const faisabilite = borne(i.faisabilite);
  const concentration = Math.min(1, Math.max(0, i.concentration ?? 1));
  const score =
    potentiel *
    (PLANCHER_FAISABILITE + (1 - PLANCHER_FAISABILITE) * (faisabilite / 10)) *
    (PLANCHER_CONCENTRATION + (1 - PLANCHER_CONCENTRATION) * concentration);
  const detail = { ...criteres, faisabilite, potentiel, concentration: concentration * 10 };
  return {
    score: arrondi(score),
    detail: Object.fromEntries(Object.entries(detail).map(([k, v]) => [k, v === null ? null : arrondi(v)])) as DetailScore,
  };
}

// Fusionne les groupes dont les centres sont très proches (même problème formulé autrement).
// Renvoie les nouveaux groupes (listes d'indices), les plus proches fusionnés en premier.
export function fusionner(vecteurs: number[][], groupes: number[][], seuil: number): number[][] {
  let courants = groupes.map((g) => [...g]);
  for (;;) {
    const centres = courants.map((g) => centre(vecteurs, g).centre);
    let meilleur = { s: seuil, a: -1, b: -1 };
    for (let a = 0; a < centres.length; a++) {
      for (let b = a + 1; b < centres.length; b++) {
        const s = centres[a].reduce((t, x, k) => t + x * centres[b][k], 0);
        if (s >= meilleur.s) meilleur = { s, a, b };
      }
    }
    if (meilleur.a < 0) return courants;
    courants[meilleur.a].push(...courants[meilleur.b]);
    courants = courants.filter((_, i) => i !== meilleur.b);
  }
}

// Solidité d'une opportunité (30/09, remarque de Maksen : « il y en a qui n'ont même pas 20 avis »).
// Sous le seuil minimum, un groupe n'entre pas dans le classement : 3 avis, c'est une anecdote.
export const CLASSEMENT_MIN = { avis: 10, applis: 2 } as const;
export type Solidite = "fort" | "moyen" | "faible";

export function solidite(nbAvis: number, nbApps: number): Solidite {
  if (nbAvis >= 30 && nbApps >= 4) return "fort";
  if (nbAvis >= CLASSEMENT_MIN.avis && nbApps >= CLASSEMENT_MIN.applis) return "moyen";
  return "faible";
}
