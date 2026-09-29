// Taille du marché : nombre d'entreprises actives en France par code NAF, via l'API Sirene de l'Insee
// (gratuite, clé requise, 30 requêtes/min). Les comptes sont gardés en mémoire pendant un passage.
//
// Nomenclature : Sirene passe à la NAF 2025 le 5 janvier 2027 (« activitePrincipaleUniteLegale » ne
// contiendra plus que des codes NAF 2025). Radar accepte les deux sortes de codes (aucun code n'existe
// dans les deux) et convertit un code NAF rév. 2 avec la table de passage officielle de l'Insee.
import { z } from "zod";
import { pause } from "../collecte/appstore";
import passage from "../../../data/naf-rev2-vers-naf2025.json";

export const FORMAT_NAF = /^\d{2}\.\d{2}[A-Z]$/;
export const BASCULE_NAF2025 = "2027-01-05";
const PAUSE_MS = 2_100; // 30 requêtes/min au maximum

type Lien = { code: string; exclusif: boolean; unique: boolean };
const TABLE: Record<string, Lien[]> = passage.table;
const NAF2025 = new Set(Object.values(TABLE).flatMap((liens) => liens.map((l) => l.code)));

export const estNaf2025 = (code: string) => NAF2025.has(code);

// Codes NAF 2025 à compter pour un code : lui-même s'il est déjà en NAF 2025 ; pour un code rév. 2,
// les codes 2025 qui ne viennent que de lui (compte exact) et celui qui le reçoit en entier s'il est
// partagé avec d'autres (compte approché, un peu trop haut). null : aucun code 2025 attribuable.
export function versNaf2025(code: string): { codes: string[]; approche: boolean } | null {
  if (estNaf2025(code)) return { codes: [code], approche: false };
  const liens = TABLE[code];
  if (!liens) return null;
  const exclusifs = liens.filter((l) => l.exclusif).map((l) => l.code);
  const partages = liens.filter((l) => !l.exclusif && l.unique).map((l) => l.code);
  const codes = [...exclusifs, ...partages];
  return codes.length ? { codes, approche: codes.length < liens.length || partages.length > 0 } : null;
}

// Après la bascule, le champ historisé porte les codes NAF 2025. Avant, les codes NAF 2025 sont
// seulement dans un champ à part, non historisé (diffusé à titre informatif depuis décembre 2025).
export function requeteSirene(codeNaf: string, jour = new Date().toISOString().slice(0, 10)): string {
  if (!FORMAT_NAF.test(codeNaf)) throw new Error(`Code NAF invalide : ${codeNaf}`);
  // Unités légales actives AUJOURD'HUI dont l'activité principale est ce code. Sans « date »,
  // periode() cherche dans tout l'historique et compte aussi les entreprises actives autrefois
  // (mesuré le 29/09/2026 : 82 765 boulangeries au lieu de 40 561).
  const q =
    estNaf2025(codeNaf) && jour < BASCULE_NAF2025
      ? `activitePrincipaleNAF25UniteLegale:${codeNaf} AND periode(etatAdministratifUniteLegale:A)`
      : `periode(activitePrincipaleUniteLegale:${codeNaf} AND etatAdministratifUniteLegale:A)`;
  return `https://api.insee.fr/api-sirene/3.11/siren?${new URLSearchParams({ q, date: jour, nombre: "1", champs: "siren" })}`;
}

export function creerCompteur(cle: string | undefined, aujourdhui = () => new Date().toISOString().slice(0, 10)) {
  const cache = new Map<string, number | null>();
  let dernier = 0;

  async function compterUn(codeNaf: string): Promise<number | null> {
    if (cache.has(codeNaf)) return cache.get(codeNaf) ?? null;
    for (let essai = 1; essai <= 3; essai++) {
      const attente = dernier + PAUSE_MS - Date.now();
      if (attente > 0) await pause(attente);
      dernier = Date.now();
      const res = await fetch(requeteSirene(codeNaf, aujourdhui()), {
        headers: { "X-INSEE-Api-Key-Integration": cle ?? "", accept: "application/json" },
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
  }

  // Renvoie le nombre d'entreprises actives, ou null si inconnu (pas de clé, code inconnu, erreur).
  // Après la bascule, un code rév. 2 est converti et ses codes NAF 2025 additionnés.
  return async function compter(codeNaf: string): Promise<number | null> {
    if (!cle || !FORMAT_NAF.test(codeNaf)) return null;
    if (aujourdhui() < BASCULE_NAF2025) return compterUn(codeNaf);
    const conversion = versNaf2025(codeNaf);
    if (!conversion) return null;
    let total = 0;
    for (const code of conversion.codes) {
      const n = await compterUn(code);
      if (n === null) return null;
      total += n;
    }
    return total;
  };
}

const reponse = z.object({ header: z.object({ total: z.number() }) });

// Note de marché sur 10 (échelle logarithmique) : 100 entreprises = 0, 1 000 ≈ 3,3, 10 000 ≈ 6,7, 100 000 = 10.
export function noteMarche(nbEntreprises: number | null): number | null {
  if (nbEntreprises === null) return null;
  return Math.min(10, Math.max(0, (10 * Math.log10(Math.max(1, nbEntreprises) / 100)) / 3));
}
