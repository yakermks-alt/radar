// Petites règles des comptes, sans accès à la base (testées dans tests/comptes).

// Adresse de retour après connexion : seulement un chemin interne (pas « //site.com » ni « /\site »).
export function cheminSur(brut: unknown, defaut = "/"): string {
  if (typeof brut !== "string" || brut.length > 300) return defaut;
  if (!brut.startsWith("/") || brut.startsWith("//") || brut.includes("\\") || /[\u0000-\u001f]/.test(brut)) return defaut;
  return brut;
}

// Message lisible pour une erreur levée par une fonction de la base (raise exception '<code>').
const MESSAGES: Record<string, string> = {
  quota_semaine: "Ton équipe a déjà utilisé son enquête de la semaine (offre gratuite). Passe à Pro pour en lancer davantage.",
  quota_jour: "Limite d'enquêtes du jour atteinte pour ton équipe. Reviens demain.",
  limite_site: "Radar a atteint sa limite d'enquêtes du jour (offres gratuites des services utilisés). Reviens demain.",
  invitation_invalide: "Ce lien d'invitation n'est plus valable (expiré, déjà utilisé ou inconnu). Demande-en un nouveau.",
  equipe_pleine: "Cette équipe est complète pour son offre.",
  abonnement_actif: "Résilie d'abord l'abonnement Pro de cette équipe.",
  equipe_inconnue: "Équipe introuvable.",
};

export function messageErreurBase(message: string): string | null {
  const code = Object.keys(MESSAGES).find((c) => message.includes(c));
  return code ? MESSAGES[code] : null;
}

// Nom affiché fourni par Google (full_name, name) ou GitHub (name, user_name).
export function nomAffiche(meta: Record<string, unknown> | undefined): string | null {
  for (const cle of ["full_name", "name", "user_name"]) {
    const v = meta?.[cle];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 80);
  }
  return null;
}
