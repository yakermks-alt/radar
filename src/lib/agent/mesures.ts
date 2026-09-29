// Suivi de chaque enquête : ce qu'elle a consommé (quotas gratuits) et combien de temps elle a pris.
// Les mesures s'additionnent d'un passage à l'autre (enquête reprise après une coupure).

export type Mesures = {
  appels_ia: Record<string, number>; // par modèle Gemini
  recherches: number; // recherches web réellement faites (quota Tavily)
  recherches_cache: number;
  pages: number; // pages téléchargées
  pages_cache: number;
  etapes_ratees: number;
  duree_s: number;
  evaluation?: Evaluation; // banc de tests seulement
};

export type Evaluation = {
  gardees: number;
  citations_absentes: number; // relecture mécanique : citation introuvable dans la source enregistrée
  chiffres_non_prouves: number;
  noms_non_prouves?: number; // nom d'entreprise ou de produit absent de la citation, du titre et de l'adresse
  non_prouvees_juge: number; // relecture par un autre modèle
  juge: string | null; // modèle qui a relu (null : relecture IA impossible)
  inventions: number; // affirmations gardées fautives, sans double compte
  sections_couvertes: number; // sur 5
  fautes?: Faute[]; // détail, pour comprendre et corriger
};

export type Faute = { texte: string; citation: string; source: string; controles: ("citation absente" | "chiffre non prouvé" | "nom non prouvé" | "relecteur")[] };

export const mesuresVides = (): Mesures => ({
  appels_ia: {},
  recherches: 0,
  recherches_cache: 0,
  pages: 0,
  pages_cache: 0,
  etapes_ratees: 0,
  duree_s: 0,
});

export function additionner(avant: Partial<Mesures> | null | undefined, ajout: Mesures): Mesures {
  const a = { ...mesuresVides(), ...(avant ?? {}) };
  const appels = { ...a.appels_ia };
  for (const [m, n] of Object.entries(ajout.appels_ia)) appels[m] = (appels[m] ?? 0) + n;
  return {
    ...a,
    appels_ia: appels,
    recherches: a.recherches + ajout.recherches,
    recherches_cache: a.recherches_cache + ajout.recherches_cache,
    pages: a.pages + ajout.pages,
    pages_cache: a.pages_cache + ajout.pages_cache,
    etapes_ratees: a.etapes_ratees + ajout.etapes_ratees,
    duree_s: Math.round((a.duree_s + ajout.duree_s) * 10) / 10,
    ...(ajout.evaluation ? { evaluation: ajout.evaluation } : {}),
  };
}

// Le quota gratuit de Gemini repart à minuit, heure du Pacifique (7 h UTC l'été, 8 h l'hiver) :
// 8 h UTC convient toute l'année. Une enquête à court de quota attend jusque-là au lieu de réessayer.
export function prochaineRemiseQuota(maintenant: Date): Date {
  const d = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate(), 8, 5));
  if (d.getTime() <= maintenant.getTime()) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export const PLAFOND_RECHERCHES_MOIS = 900; // sur 1 000 gratuites : marge pour les essais à la main
export const REPRISES_MAX = 5;
