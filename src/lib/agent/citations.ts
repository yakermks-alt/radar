// Garde-fou contre les inventions : chaque affirmation du rapport doit citer mot pour mot un
// passage d'une source que l'agent a réellement lue. Sinon elle est rejetée.

// Comparaison tolérante sur la forme (casse, espaces, apostrophes et guillemets typographiques,
// points de suspension), jamais sur les mots.
export function normaliser(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”«»„]/g, '"')
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

export const CITATION_MIN = 12; // en dessous, une citation ne prouve rien (« le prix »)

export type Affirmation = { texte: string; source: string; citation: string };
export type Rejet = Affirmation & { raison: "source inconnue" | "citation introuvable" | "citation trop courte" };

export function verifierAffirmations(
  affirmations: Affirmation[],
  sources: Map<string, string>, // url -> texte lu
): { gardees: Affirmation[]; rejetees: Rejet[] } {
  const index = new Map([...sources].map(([url, texte]) => [url, normaliser(texte)]));
  const gardees: Affirmation[] = [];
  const rejetees: Rejet[] = [];
  for (const a of affirmations) {
    const texte = index.get(a.source);
    const citation = normaliser(a.citation).replace(/^[\s"]+|[\s"]+$/g, ""); // « … » ou "…" autour
    if (texte === undefined) rejetees.push({ ...a, raison: "source inconnue" });
    else if (citation.length < CITATION_MIN) rejetees.push({ ...a, raison: "citation trop courte" });
    else if (!texte.includes(citation)) rejetees.push({ ...a, raison: "citation introuvable" });
    else gardees.push(a);
  }
  return { gardees, rejetees };
}
