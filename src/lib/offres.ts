// Offres de Radar (phase 6). Stripe est en mode test : aucun vrai paiement.
// Les limites sont appliquées côté serveur (fonction reserver_enquete, pages, actions), jamais
// seulement à l'affichage.

export type Plan = "gratuit" | "pro";

export const OFFRES = {
  gratuit: {
    nom: "Gratuit",
    prixMois: 0,
    opportunites: 3, // opportunités du classement visibles chaque jour
    enquetesSemaine: 1,
    enquetesJour: 1,
    membres: 3,
    alertes: false,
  },
  pro: {
    nom: "Pro",
    prixMois: 19, // € HT par mois, en mode test
    opportunites: 20,
    enquetesSemaine: 35,
    enquetesJour: 5, // plafond technique : les services gratuits limitent le site entier (voir LIMITES.md)
    membres: 10,
    alertes: true,
  },
} as const satisfies Record<Plan, unknown>;

export const ENQUETES_SITE_PAR_JOUR = 10; // ~1 000 recherches web/mois, ~500 appels Flash-Lite/jour
export const SECTEURS_MAX = 10;

// Numéro du jour à Paris (jours écoulés depuis le 1er janvier 1970) : change à minuit, heure de Paris.
export function numeroDuJour(date: Date): number {
  const [a, m, j] = date.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }).split("-").map(Number);
  return Math.floor(Date.UTC(a, m - 1, j) / 86_400_000);
}

// Offre gratuite : « 3 opportunités par jour » qui tournent dans le classement, un nouveau lot chaque
// jour (le même pour tout le monde ce jour-là, sur la page comme dans l'email du matin). Le dernier lot
// se complète avec le haut du classement : toujours n opportunités (30/09 : lot de 2 sur 20).
export function selectionDuJour<T>(classement: T[], date: Date, n: number = OFFRES.gratuit.opportunites): T[] {
  if (classement.length <= n) return classement;
  const lots = Math.ceil(classement.length / n);
  const debut = (numeroDuJour(date) % lots) * n;
  return Array.from({ length: n }, (_, k) => classement[(debut + k) % classement.length]);
}

// Statut d'un abonnement Stripe → offre de l'équipe (past_due : Stripe réessaie encore le paiement).
export function planSelonStatut(statut: string): Plan {
  return ["active", "trialing", "past_due"].includes(statut) ? "pro" : "gratuit";
}
