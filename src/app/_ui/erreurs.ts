// Raison d'arrêt d'une enquête, dite simplement (le message technique reste dans la base).
export function erreurLisible(erreur: string | null): string {
  if (!erreur) return "erreur inconnue";
  if (/quota/i.test(erreur)) return "le quota gratuit de l'IA est épuisé pour aujourd'hui";
  if (/trop lent|injoignable|timeout|aborted/i.test(erreur)) return "l'IA a mis trop de temps à répondre";
  if (/hors sch[ée]ma/i.test(erreur)) return "l'IA a renvoyé une réponse mal formée";
  if (/indisponible|503|satur/i.test(erreur)) return "l'IA est surchargée en ce moment";
  return "une erreur technique";
}
