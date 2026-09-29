// Garde-fou contre les inventions : chaque affirmation du rapport doit citer mot pour mot un
// passage d'une source que l'agent a réellement lue. Sinon elle est rejetée.

// Comparaison tolérante sur la forme (casse, espaces, ponctuation, puces d'une liste recopiée
// avec des virgules), jamais sur les mots ni les chiffres : on ne compare que la suite des mots.
export function normaliser(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// Une citation peut sauter un passage avec « … » ou « [...] » : chaque morceau doit alors être
// exact et apparaître dans l'ordre.
function morceaux(citation: string): string[] {
  return citation.split(/\s*(?:\[\s*(?:\.\.\.|…)\s*\]|\.\.\.|…)\s*/).map(normaliser).filter(Boolean);
}

function trouve(texte: string, parts: string[]): boolean {
  let depuis = 0;
  for (const p of parts) {
    const i = ` ${texte} `.indexOf(` ${p} `, depuis);
    if (i < 0) return false;
    depuis = i + p.length;
  }
  return true;
}

export const CITATION_MIN = 12; // en dessous, une citation ne prouve rien (« le prix »)

export type Affirmation = { texte: string; source: string; citation: string };
export type Rejet = Affirmation & {
  raison: "source inconnue" | "citation introuvable" | "citation trop courte" | "chiffre non prouvé" | "citation hors sujet";
};

// Nombres d'un texte, sous une forme comparable : « 40 561 » = « 40561 », « 9,00 € » = « 9 € »,
// « 1,5 % » = « 1.5 % ». Les séparateurs de milliers (espace, espace fine, point suivi de 3 chiffres) sautent.
export function nombres(texte: string): Set<string> {
  // Milliers : espace ou point suivi d'exactement 3 chiffres ; décimales : virgule ou point collés.
  const brut = texte.match(/\d+(?:[ \u00a0\u202f.]\d{3}(?!\d))*(?:[.,]\d+)?/g) ?? [];
  return new Set(
    brut.map((n) =>
      n
        .replace(/[\s\u00a0\u202f]+/g, "")
        .replace(/\.(?=\d{3}(?:\D|$))/g, "")
        .replace(/,/g, ".")
        .replace(/\.0+$/, ""),
    ),
  );
}

// Filet sans IA contre l'invention la plus dangereuse : un chiffre de l'affirmation (prix,
// nombre d'entreprises, pourcentage) doit se trouver dans sa citation.
export function chiffresProuves(affirmation: string, citation: string): boolean {
  const cites = nombres(citation);
  return [...nombres(affirmation)].every((n) => cites.has(n));
}

export function verifierAffirmations(
  affirmations: Affirmation[],
  sources: Map<string, string>, // url -> texte lu
): { gardees: Affirmation[]; rejetees: Rejet[] } {
  const index = new Map([...sources].map(([url, texte]) => [url, normaliser(texte)]));
  const gardees: Affirmation[] = [];
  const rejetees: Rejet[] = [];
  for (const a of affirmations) {
    const texte = index.get(a.source);
    const parts = morceaux(a.citation);
    if (texte === undefined) rejetees.push({ ...a, raison: "source inconnue" });
    else if (!parts.length || parts.some((p) => p.length < CITATION_MIN)) rejetees.push({ ...a, raison: "citation trop courte" });
    else if (!trouve(texte, parts)) rejetees.push({ ...a, raison: "citation introuvable" });
    else if (!chiffresProuves(a.texte, a.citation)) rejetees.push({ ...a, raison: "chiffre non prouvé" });
    else gardees.push(a);
  }
  return { gardees, rejetees };
}
