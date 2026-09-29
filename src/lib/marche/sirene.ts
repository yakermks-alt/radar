// Taille du marché : nombre d'entreprises actives en France par code NAF, via l'API Sirene de l'Insee
// (gratuite, clé requise, 30 requêtes/min). Les comptes sont gardés en mémoire pendant un passage.
import { z } from "zod";
import { pause } from "../collecte/appstore";

export const FORMAT_NAF = /^\d{2}\.\d{2}[A-Z]$/;
const PAUSE_MS = 2_100; // 30 requêtes/min au maximum

const reponse = z.object({ header: z.object({ total: z.number() }) });

export function requeteSirene(codeNaf: string, jour = new Date().toISOString().slice(0, 10)): string {
  if (!FORMAT_NAF.test(codeNaf)) throw new Error(`Code NAF invalide : ${codeNaf}`);
  // Unités légales actives AUJOURD'HUI dont l'activité principale est ce code. Sans « date »,
  // periode() cherche dans tout l'historique et compte aussi les entreprises actives autrefois
  // (mesuré le 29/09/2026 : 82 765 boulangeries au lieu de 40 561).
  const q = `periode(activitePrincipaleUniteLegale:${codeNaf} AND etatAdministratifUniteLegale:A)`;
  return `https://api.insee.fr/api-sirene/3.11/siren?${new URLSearchParams({ q, date: jour, nombre: "1", champs: "siren" })}`;
}

export function creerCompteur(cle: string | undefined) {
  const cache = new Map<string, number | null>();
  let dernier = 0;

  // Renvoie le nombre d'entreprises actives, ou null si inconnu (pas de clé, code inconnu, erreur).
  return async function compter(codeNaf: string): Promise<number | null> {
    if (!cle || !FORMAT_NAF.test(codeNaf)) return null;
    if (cache.has(codeNaf)) return cache.get(codeNaf) ?? null;

    for (let essai = 1; essai <= 3; essai++) {
      const attente = dernier + PAUSE_MS - Date.now();
      if (attente > 0) await pause(attente);
      dernier = Date.now();
      const res = await fetch(requeteSirene(codeNaf), {
        headers: { "X-INSEE-Api-Key-Integration": cle, accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
      }).catch(() => null);
      if (res?.status === 404) {
        cache.set(codeNaf, 0); // aucun résultat : code sans entreprise active
        return 0;
      }
      if (res?.ok) {
        const n = reponse.parse(await res.json()).header.total;
        cache.set(codeNaf, n);
        return n;
      }
      if (res && res.status !== 429 && res.status < 500) break; // clé refusée, requête invalide
      await pause(10_000 * essai);
    }
    cache.set(codeNaf, null);
    return null;
  };
}

// Note de marché sur 10 (échelle logarithmique) : 100 entreprises = 0, 1 000 ≈ 3,3, 10 000 ≈ 6,7, 100 000 = 10.
export function noteMarche(nbEntreprises: number | null): number | null {
  if (nbEntreprises === null) return null;
  return Math.min(10, Math.max(0, (10 * Math.log10(Math.max(1, nbEntreprises) / 100)) / 3));
}
