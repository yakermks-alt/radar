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
  raison: "source inconnue" | "citation introuvable" | "citation trop courte" | "chiffre non prouvé" | "nom non prouvé" | "citation hors sujet";
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

// Mots à majuscule qui ne désignent ni une entreprise ni un produit.
const COMMUNS = new Set(
  (
    "un une le la les l d de du des au aux en et ou il elle ils on ce cette ces selon apres après fin sur par pour avec " +
    "france francais français europe paris ht ttc tva ia crm erp pme tpe eti sav naf siren siret idel btp dom tom pdf sms " +
    "app appli application internet web mobile iphone android ios pro " +
    "janvier fevrier février mars avril mai juin juillet aout août septembre octobre novembre decembre décembre"
  ).split(" "),
);

// Mots courants en tête de phrase (le premier mot porte une majuscule sans être un nom propre).
const DEBUTS = new Set(
  (
    "certains certaines plusieurs chaque aucun aucune seuls seules nombre cet leur leurs son sa ses notre votre tous toutes " +
    "tout toute environ pres près plus moins si quand lorsque depuis entre grace grâce face malgre malgré parmi outre meme même " +
    "autre autres aujourd'hui aujourd hui dans sans sous vers chez comme alors ainsi enfin cependant pourtant or donc mais " +
    "les clients utilisateurs professionnels logiciel logiciels offre offres prix marche marché secteur ce ces cette il existe"
  ).split(" "),
);

const plat = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Noms propres d'une affirmation : mots à majuscule (hors début de phrase) ou sigles, élisions comprises
// (« d'HubSpot » donne « HubSpot »).
export function nomsPropres(texte: string): string[] {
  const noms: string[] = [];
  for (const phrase of texte.split(/(?<=[.!?])\s+/)) {
    const mots = phrase.split(/[\s,;:()«»"]+/).map((m) => m.replace(/^[\p{L}]{1,2}['’]/u, "").replace(/[.'’]+$/, ""));
    mots.forEach((m, i) => {
      if (i === 0 && DEBUTS.has(plat(m))) return; // mot courant en tête de phrase
      if (/^\p{Lu}/u.test(m) && /\p{L}{2}/u.test(m) && !COMMUNS.has(plat(m))) noms.push(m);
    });
  }
  return noms;
}

// Filet sans IA : chaque entreprise ou produit nommé doit apparaître dans la citation, le titre ou
// l'adresse de la source. Sinon le lecteur ne peut pas vérifier de qui on parle.
export function nomsProuves(affirmation: string, citation: string, titre: string | null, url: string): boolean {
  const contexte = plat(`${citation} ${titre ?? ""} ${url.replace(/[./_-]+/g, " ")}`).replace(/[^\p{L}\p{N}]+/gu, " ");
  return nomsPropres(affirmation).every((n) => contexte.includes(plat(n).replace(/[^\p{L}\p{N}]+/gu, " ").trim()));
}

export function verifierAffirmations(
  affirmations: Affirmation[],
  sources: Map<string, string>, // url -> texte lu
  titres?: Map<string, string | null>, // url -> titre ; sans titres, le contrôle des noms est sauté
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
    else if (titres && !nomsProuves(a.texte, a.citation, titres.get(a.source) ?? null, a.source)) rejetees.push({ ...a, raison: "nom non prouvé" });
    else gardees.push(a);
  }
  return { gardees, rejetees };
}

// Comptage Sirene fait par Radar lui-même (outil « entreprises » avec un code NAF) : la phrase est
// écrite par le code à partir de l'API de l'Insee, pas tirée d'une page. Si l'affirmation reprend ce
// comptage (même nombre, même code), elle est prouvée par construction : la relire par une IA ne
// mesure que les erreurs du relecteur (2e banc du 30/09 : 4 refus sur 4 de ces phrases par Flash-Lite).
const PHRASE_SIRENE = /^Au \d{4}-\d{2}-\d{2}, ([\d\s  ]+) entreprises actives en France ont pour activité principale le code NAF (\d{2}\.\d{2}[A-Z]) \(répertoire Sirene de l'Insee\)\.$/;

export function comptageSirene(a: Affirmation): boolean {
  const m = PHRASE_SIRENE.exec(a.citation.trim());
  if (!m || a.source !== `https://www.insee.fr/fr/metadonnees/nafr2/sousClasse/${m[2]}`) return false;
  return a.texte.includes(m[2]) && chiffresProuves(a.texte, a.citation);
}
