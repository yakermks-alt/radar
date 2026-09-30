// Accès aux données publiques de l'App Store (France) : recherche d'applis et flux d'avis.
// Aucune clé requise. Apple limite le débit (environ 20 requêtes/min sur la recherche) :
// les appelants espacent leurs requêtes, et `recupererJson` réessaie en cas de refus temporaire.
import { createHash } from "node:crypto";
import { z } from "zod";

export const PAGES_AVIS_MAX = 10; // Apple ne sert pas au-delà de 10 pages de 50 avis.

// App Stores francophones : mêmes applis, avis différents (le flux est propre à chaque pays).
export const PAYS = ["fr", "be", "ch", "ca"] as const;
export type Pays = (typeof PAYS)[number];

const libelle = z.object({ label: z.string() });

const entreeAvis = z.object({
  id: libelle,
  author: z.object({ name: libelle }).optional(),
  updated: libelle.optional(),
  "im:rating": libelle,
  "im:version": libelle.optional(),
  title: libelle.optional(),
  content: libelle,
});

const fluxAvis = z.object({
  feed: z.object({
    entry: z.union([z.array(z.unknown()), z.unknown()]).optional(),
    link: z
      .array(z.object({ attributes: z.object({ rel: z.string(), href: z.string() }).partial() }))
      .optional(),
  }),
});

export type AvisBrut = {
  idExterne: string;
  note: number;
  titre: string | null;
  contenu: string;
  auteurEmpreinte: string | null;
  versionApp: string | null;
  publieLe: string | null;
};

export type ResultatPage = { avis: AvisBrut[]; dernierePage: number | null; ignores: number };

// Empreinte du pseudo : permet de repérer un même auteur sans stocker son pseudo.
export function empreinteAuteur(pseudo: string | undefined): string | null {
  const p = pseudo?.trim();
  if (!p) return null;
  return createHash("sha256").update(`radar:auteur:${p.toLowerCase()}`).digest("hex").slice(0, 32);
}

// Transforme une page du flux JSON d'avis en avis prêts à enregistrer.
export function lireFluxAvis(json: unknown): ResultatPage {
  const flux = fluxAvis.parse(json).feed;
  // Une page avec un seul avis renvoie un objet au lieu d'une liste.
  const entrees = flux.entry === undefined ? [] : Array.isArray(flux.entry) ? flux.entry : [flux.entry];

  const avis: AvisBrut[] = [];
  let ignores = 0;
  for (const e of entrees) {
    const r = entreeAvis.safeParse(e);
    const note = r.success ? Number(r.data["im:rating"].label) : NaN;
    const contenu = r.success ? r.data.content.label.trim() : "";
    if (!r.success || !Number.isInteger(note) || note < 1 || note > 5 || !contenu) {
      ignores++;
      continue;
    }
    const d = r.data;
    avis.push({
      idExterne: d.id.label,
      note,
      titre: d.title?.label.trim() || null,
      contenu: contenu.slice(0, 10_000),
      auteurEmpreinte: empreinteAuteur(d.author?.name.label),
      versionApp: d["im:version"]?.label || null,
      publieLe: d.updated?.label ? new Date(d.updated.label).toISOString() : null,
    });
  }

  const last = flux.link?.find((l) => l.attributes.rel === "last")?.attributes.href;
  const m = last?.match(/page=(\d+)/);
  return { avis, dernierePage: m ? Number(m[1]) : null, ignores };
}

export function urlAvis(storeId: string, page: number, pays: Pays = "fr"): string {
  if (!/^\d+$/.test(storeId)) throw new Error(`Identifiant App Store invalide : ${storeId}`);
  if (!Number.isInteger(page) || page < 1 || page > PAGES_AVIS_MAX) throw new Error(`Page invalide : ${page}`);
  if (!PAYS.includes(pays)) throw new Error(`Pays invalide : ${pays}`);
  return `https://itunes.apple.com/${pays}/rss/customerreviews/page=${page}/id=${storeId}/sortby=mostrecent/json`;
}

const resultatRecherche = z.object({
  results: z.array(
    z.object({
      trackId: z.number(),
      trackName: z.string(),
      sellerName: z.string().optional(),
      primaryGenreName: z.string().optional(),
      averageUserRating: z.number().optional(),
      userRatingCount: z.number().optional(),
      formattedPrice: z.string().optional(),
      trackViewUrl: z.string().optional(),
      description: z.string().optional(),
    }),
  ),
});

export type AppTrouvee = {
  storeId: string;
  nom: string;
  editeur: string | null;
  genre: string | null;
  noteMoyenne: number | null;
  nbNotes: number;
  prix: string | null;
  url: string | null;
  description: string;
};

export function lireRecherche(json: unknown): AppTrouvee[] {
  return resultatRecherche.parse(json).results.map((r) => ({
    storeId: String(r.trackId),
    nom: r.trackName,
    editeur: r.sellerName ?? null,
    genre: r.primaryGenreName ?? null,
    noteMoyenne: r.averageUserRating ?? null,
    nbNotes: r.userRatingCount ?? 0,
    prix: r.formattedPrice ?? null,
    url: r.trackViewUrl?.split("?")[0] ?? null,
    description: (r.description ?? "").replace(/\s+/g, " ").slice(0, 400),
  }));
}

export function urlRecherche(terme: string, limite = 25): string {
  const q = new URLSearchParams({ term: terme, country: "fr", entity: "software", limit: String(Math.min(200, Math.max(1, limite))), lang: "fr_fr" });
  return `https://itunes.apple.com/search?${q}`;
}

export const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// GET JSON avec nouvelles tentatives sur les refus temporaires (429, 5xx) et les coupures réseau.
export async function recupererJson(url: string, essais = 4): Promise<unknown | null> {
  for (let i = 1; i <= essais; i++) {
    let res: Response | null = null;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { accept: "application/json" } });
    } catch (e) {
      if (i === essais) throw e; // coupure réseau ou délai dépassé : on réessaie
    }
    if (res?.ok) return await res.json();
    // 400/404 = page au-delà de la dernière : pas la peine de réessayer.
    if (res && (res.status === 400 || res.status === 404)) return null;
    if (res && res.status !== 429 && res.status < 500) throw new Error(`HTTP ${res.status} sur ${url}`);
    if (i < essais) await pause(2_000 * 2 ** i);
  }
  throw new Error(`Échec après ${essais} essais : ${url}`);
}
