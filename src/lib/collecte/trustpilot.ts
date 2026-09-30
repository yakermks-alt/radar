// Découpage d'une page Trustpilot (texte renvoyé par la recherche Tavily) en avis individuels :
// note, titre, texte, date. Le pseudo de l'auteur n'est jamais gardé. Formats anglais et français.

export type AvisTrustpilot = { id: string; note: number; titre: string | null; contenu: string; date: string | null };

// Domaine de la fiche (« zelty.fr » pour https://fr.trustpilot.com/review/zelty.fr), ou null.
export function domaineTrustpilot(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)trustpilot\.com$/.test(u.hostname)) return null;
    const m = /^\/review\/([a-z0-9.-]+\.[a-z]{2,})\/?$/i.exec(u.pathname);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

const ENTETE = /## \[([^\]]*)\]\(https:\/\/[a-z.]*trustpilot\.com\/reviews\/([a-f0-9]{8,})\)\n/g;
const NOTE = /(?:Rated|Noté) (\d) (?:out of|sur) 5/g;
const FIN = /\n\s*\n(?:[A-Z][a-z]+ \d{1,2}, \d{4}|\d{1,2} [a-zéû]+ \d{4})\s*\n/;
const DATE_EN = /^([A-Z][a-z]+ \d{1,2}, \d{4})$/;

export function decouperTrustpilot(texte: string): { nomEntreprise: string | null; avis: AvisTrustpilot[] } {
  const nomEntreprise = /^# (.+?) (?:Reviews|avis)\s*$/m.exec(texte)?.[1]?.trim() ?? null;
  const avis: AvisTrustpilot[] = [];
  for (const m of texte.matchAll(ENTETE)) {
    const debut = m.index ?? 0;
    // La note est l'étoile affichée juste avant le titre de l'avis.
    const avant = texte.slice(Math.max(0, debut - 600), debut);
    const notes = [...avant.matchAll(NOTE)];
    const note = notes.length ? Number(notes[notes.length - 1][1]) : NaN;
    if (!(note >= 1 && note <= 5)) continue;
    const reste = texte.slice(debut + m[0].length);
    const fin = FIN.exec(reste);
    if (!fin) continue;
    const contenu = reste
      .slice(0, fin.index)
      .replace(/[ \t]+\n/g, "\n")
      .trim()
      .slice(0, 10_000);
    if (!contenu) continue;
    const ligneDate = fin[0].trim();
    const date = DATE_EN.test(ligneDate) && !Number.isNaN(Date.parse(ligneDate)) ? new Date(`${ligneDate} 12:00 UTC`).toISOString() : null;
    avis.push({ id: m[2], note, titre: m[1].trim().slice(0, 300) || null, contenu, date });
  }
  return { nomEntreprise, avis };
}
