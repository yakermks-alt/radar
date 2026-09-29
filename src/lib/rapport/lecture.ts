// Ce que l'écran du rapport tire des affirmations vérifiées : prix des concurrents (graphique),
// taille du marché (Insee) et bilan de fiabilité. Rien n'est inventé : une valeur qu'on ne sait
// pas lire proprement n'est pas affichée.
import type { Rapport } from "../agent/agent";
import { nomsPropres, type Affirmation } from "../agent/citations";

export type Taxe = "HT" | "TTC" | null;
// prix : toujours mensuel (un prix annuel est divisé par 12 et gardé dans « annuel »).
export type Prix = { nom: string; prix: number; taxe: Taxe; source: string; annuel?: number };

const hote = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const plat = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// « 19 € », « 9,00 € HT », « 129 euros TTC ». Les prix en dollars ne sont pas comparés.
const PRIX = /(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:€|euros?\b)/i;

export function taxe(texte: string): Taxe {
  if (/\bTTC\b/.test(texte)) return "TTC";
  if (/\bHT\b|hors taxes?/i.test(texte)) return "HT";
  return null;
}

// Le concurrent dont parle l'affirmation : premier nom propre qui n'est pas la source elle-même
// (« Selon Codeur.com, Evoliz propose… » donne Evoliz, pas Codeur.com).
export function concurrent(a: Affirmation): string | null {
  const source = plat(hote(a.source)).replace(/[^\p{L}\p{N}]+/gu, "");
  const noms = nomsPropres(a.texte).filter((n) => !source.includes(plat(n).replace(/[^\p{L}\p{N}]+/gu, "")) && !/^(Selon|Insee|Sirene)$/i.test(n));
  if (!noms.length) return null;
  // Noms qui se suivent dans le texte (« Albus Latitude », « Agathe YOU ») : on les garde ensemble.
  const debut = a.texte.indexOf(noms[0]);
  const suite = a.texte.slice(debut).match(/^[\p{Lu}][\p{L}\p{N}.'’-]*(?:\s+[\p{Lu}\d][\p{L}\p{N}.'’-]*)*/u);
  return (suite?.[0] ?? noms[0]).trim();
}

export function prixConcurrents(r: Rapport): Prix[] {
  const section = r.sections.find((s) => s.titre === "Concurrents et prix");
  const vus = new Set<string>();
  const prix: Prix[] = [];
  for (const a of section?.affirmations ?? []) {
    const m = a.texte.match(PRIX);
    const nom = concurrent(a);
    if (!m || !nom || vus.has(nom)) continue;
    vus.add(nom);
    const montant = Number(m[1].replace(",", "."));
    const parAn = /\b(par an|annuels?|annuelles?|\/\s?an)\b/i.test(`${a.texte} ${a.citation}`) && !/\bpar mois\b|\/\s?mois/i.test(a.texte);
    const p: Prix = { nom, prix: parAn ? Math.round(montant / 12) : montant, taxe: taxe(`${a.texte} ${a.citation}`), source: a.source };
    if (parAn) p.annuel = montant;
    prix.push(p);
  }
  return prix.sort((x, y) => x.prix - y.prix);
}

// Nombre d'entreprises du métier, tel que compté par l'Insee (le plus grand s'il y a plusieurs codes).
export function entreprisesInsee(r: Rapport): number | null {
  const section = r.sections.find((s) => s.titre === "Taille du marché");
  const nombres = (section?.affirmations ?? [])
    .filter((a) => /insee/i.test(a.source) || /insee/i.test(a.citation))
    .map((a) => a.citation.match(/(\d{1,3}(?:[\s  ]\d{3})+|\d+)\s+entreprises/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => Number(m[1].replace(/[\s  ]/g, "")));
  return nombres.length ? Math.max(...nombres) : null;
}

export function fiabilite(r: Rapport): { gardees: number; retirees: number; parRaison: Record<string, number> } {
  const gardees = r.sections.reduce((n, s) => n + s.affirmations.length, 0);
  const parRaison: Record<string, number> = {};
  for (const x of r.rejetees) parRaison[x.raison] = (parRaison[x.raison] ?? 0) + 1;
  return { gardees, retirees: r.rejetees.length, parRaison };
}

// Une fourchette de prix n'a de sens qu'entre prix de même nature (tous HT ou tous TTC).
export function memeTaxe(prix: Prix[]): boolean {
  return new Set(prix.map((p) => p.taxe)).size <= 1;
}
