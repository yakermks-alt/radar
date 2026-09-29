// Lecture d'une page web par l'agent, avec trois protections :
// 1. adresses internes refusées (l'agent ne doit pas pouvoir sonder le réseau de la machine) ;
// 2. texte caché retiré (commentaires, éléments invisibles : là où se cachent les pièges) ;
// 3. détection des instructions destinées à une IA, pour marquer la page comme suspecte.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const TEXTE_MAX = 60_000;
const OCTETS_MAX = 2_000_000;
const REDIRECTIONS_MAX = 3;

// Plages privées, locales, réservées : jamais lues, même via une redirection.
export function adressePublique(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // lien local, métadonnées des clouds
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    const mappe = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mappe) return adressePublique(mappe[1]);
    return !(x === "::" || x === "::1" || /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith("ff") || x.startsWith("64:ff9b"));
  }
  return false;
}

// Vérifie le schéma, le port et que le nom résout uniquement vers des adresses publiques.
export async function urlAutorisee(brute: string, resoudre = lookup): Promise<URL> {
  const url = new URL(brute);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Seules les pages http(s) sont lues");
  if (url.username || url.password) throw new Error("URL avec identifiants refusée");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Port non standard refusé");
  const hote = url.hostname.replace(/^\[|\]$/g, "");
  const adresses = isIP(hote) ? [{ address: hote }] : await resoudre(hote, { all: true });
  if (!adresses.length || !adresses.every((a) => adressePublique(a.address))) throw new Error("Adresse interne refusée");
  return url;
}

const ENTITES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", eacute: "é", egrave: "è", ecirc: "ê",
  agrave: "à", acirc: "â", ccedil: "ç", ocirc: "ô", ucirc: "û", ugrave: "ù", icirc: "î", iuml: "ï",
  euro: "€", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", hellip: "…", mdash: "-", ndash: "-",
};

function decoder(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return ENTITES[e.toLowerCase()] ?? m;
  });
}

const STYLE_CACHE = /aria-hidden\s*=\s*["']?true|display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0(?![.\d]*[1-9])|opacity\s*:\s*0(?![.\d]*[1-9])/i;

function cache(attributs: string): boolean {
  if (STYLE_CACHE.test(attributs) || /(^|\s)hidden(\s|=|$)/i.test(attributs)) return true;
  // Classes d'invisibilité (sauf « hidden md:block », visible sur grand écran).
  const classes = attributs.match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1].split(/\s+/) ?? [];
  if (classes.some((c) => c === "sr-only" || c === "visually-hidden")) return true;
  return classes.includes("hidden") && !classes.some((c) => /^[a-z0-9-]+:(block|flex|grid|inline|inline-block|inline-flex|table|contents)$/.test(c));
}
const VIDES = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

// Retire un élément invisible et tout son contenu (en comptant les balises de même nom imbriquées).
function retirerCaches(html: string): string {
  const ouvrante = /<([a-z][a-z0-9-]*)\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = ouvrante.exec(html))) {
    const [balise, nom, attributs] = m;
    if (!cache(attributs) || VIDES.has(nom.toLowerCase()) || balise.endsWith("/>")) continue;
    const meme = new RegExp(`<(/?)${nom}\\b[^>]*>`, "gi");
    meme.lastIndex = m.index + balise.length;
    let profondeur = 1;
    let fin = html.length;
    let t: RegExpExecArray | null;
    while ((t = meme.exec(html))) {
      profondeur += t[1] ? -1 : 1;
      if (profondeur === 0) { fin = t.index + t[0].length; break; }
    }
    html = html.slice(0, m.index) + " " + html.slice(fin);
    ouvrante.lastIndex = m.index;
  }
  return html;
}

export function extraireTexte(html: string): { titre: string | null; texte: string } {
  const titre = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  let h = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg|head|iframe|object)\b[\s\S]*?<\/\1\s*>/gi, " ");
  h = retirerCaches(h);
  const texte = decoder(
    h
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)\b[^>]*>/gi, "\n")
      // Balises en ligne collées : « <span>5</span><span>,40</span> » doit donner « 5,40 ».
      .replace(/<\/?(span|a|b|strong|em|i|u|sup|sub|small|mark|abbr|bdi|data|time|s)\b[^>]*>/gi, "")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
  return { titre: titre ? decoder(titre).replace(/\s+/g, " ").trim().slice(0, 300) || null : null, texte: texte.slice(0, TEXTE_MAX) };
}

// Phrases typiques d'une injection d'instructions (français et anglais).
const INJECTION = [
  /ignore[sz]?\s+(all\s+|any\s+)?(the\s+)?(previous|prior|above|earlier)\s+(instructions|prompts?|rules)/i,
  /(disregard|forget)\s+(all\s+|any\s+|your\s+)?(previous|prior|above)?\s*(instructions|rules|prompts?)/i,
  /ignore[rz]?\s+(toutes?\s+)?(les\s+)?(instructions|consignes|r[èe]gles)\s+(pr[ée]c[ée]dentes|ci-dessus|donn[ée]es)/i,
  /oublie[rz]?\s+(toutes?\s+)?(tes|vos|les)\s+(instructions|consignes)/i,
  /\b(you are now|from now on you|new instructions|system prompt|as an ai (agent|assistant|model))\b/i,
  /\b(tu es d[ée]sormais|nouvelles instructions|prompt syst[èe]me|en tant qu'(ia|agent|assistant))\b/i,
  /<\/?(system|instructions?|assistant)>/i,
  /\b(AI|LLM|agent)s?\s*(reading|parsing) this\b/i,
];

export function semblePiege(texte: string): boolean {
  return INJECTION.some((r) => r.test(texte));
}

export type Page = { url: string; titre: string | null; texte: string; suspecte: boolean };

// Télécharge une page (redirections vérifiées une à une), taille et durée plafonnées.
export async function lirePage(brute: string, f: typeof fetch = fetch, resoudre = lookup): Promise<Page> {
  let url = await urlAutorisee(brute, resoudre);
  for (let saut = 0; ; saut++) {
    const res = await f(url, {
      redirect: "manual",
      headers: { "user-agent": "RadarBot/0.1 (projet étudiant ; lecture ponctuelle)", accept: "text/html,text/plain" },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status >= 300 && res.status < 400) {
      const cible = res.headers.get("location");
      if (!cible || saut >= REDIRECTIONS_MAX) throw new Error("Trop de redirections");
      url = await urlAutorisee(new URL(cible, url).toString(), resoudre);
      continue;
    }
    if (!res.ok) throw new Error(`Page ${res.status}`);
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/i.test(type)) throw new Error(`Type non lu : ${type.split(";")[0] || "inconnu"}`);
    const brut = await lireLimite(res, OCTETS_MAX);
    const { titre, texte } = /text\/plain/i.test(type) ? { titre: null, texte: brut.slice(0, TEXTE_MAX) } : extraireTexte(brut);
    if (!texte) throw new Error("Page sans texte lisible");
    return { url: url.toString(), titre, texte, suspecte: semblePiege(texte) };
  }
}

async function lireLimite(res: Response, max: number): Promise<string> {
  if (!res.body) return "";
  const lecteur = res.body.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.length;
    if (total > max) { await lecteur.cancel(); break; }
    morceaux.push(value);
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(morceaux));
}
