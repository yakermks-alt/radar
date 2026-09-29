// Cache partagé entre enquêtes (table cache_web) : une recherche ou une page déjà faite dans les
// 7 derniers jours n'est pas refaite. Économise les 1 000 recherches web gratuites du mois et
// accélère les enquêtes proches. Une panne du cache ne bloque jamais l'enquête.
import type { z } from "zod";

export const DUREE_CACHE_MS = 7 * 24 * 3600 * 1000;

export type Magasin = {
  lire: (cle: string) => Promise<{ contenu: unknown; cree_le: string } | null>;
  ecrire: (cle: string, contenu: unknown) => Promise<void>;
};

export const cleRecherche = (requete: string) => `recherche:${requete.toLowerCase().replace(/\s+/g, " ").trim()}`.slice(0, 1100);
export const clePage = (url: string) => `page:${url}`.slice(0, 1100);

export async function avecCache<T>(
  magasin: Magasin | undefined,
  cle: string,
  schema: z.ZodType<T>,
  calcul: () => Promise<T>,
  maintenant = Date.now(),
): Promise<{ valeur: T; depuisCache: boolean }> {
  if (magasin) {
    const trouve = await magasin.lire(cle).catch(() => null);
    if (trouve && maintenant - Date.parse(trouve.cree_le) < DUREE_CACHE_MS) {
      const v = schema.safeParse(trouve.contenu);
      if (v.success) return { valeur: v.data, depuisCache: true };
    }
  }
  const valeur = await calcul();
  if (magasin) await magasin.ecrire(cle, valeur).catch(() => undefined);
  return { valeur, depuisCache: false };
}
