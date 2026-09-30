import "server-only";
import { createClient } from "@supabase/supabase-js";
import { envServeur } from "../env";
import { OFFRES, selectionDuJour, type Plan } from "../offres";

// Client serveur (clé secrète) : jamais importé côté navigateur, grâce à "server-only".
export function baseServeur() {
  const env = envServeur();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
}

export type Citation = { note: number; titre: string | null; contenu: string; app: string };
export type Marche = { codes: { code: string; entreprises: number }[]; total: number };
export type Faiblesses = { bug: number; support: number; prix: number; exemples: { categorie: string; probleme: string }[] };
export type Opportunite = {
  id: number;
  rang: number; // place dans le classement complet
  nom: string;
  resume: string | null;
  secteur: string | null;
  nbAvis: number;
  nbApps: number;
  score: number;
  detail: Record<string, number>;
  faiblesses: Faiblesses | null;
  marche: Marche | null;
  citations: Citation[];
};

type Ligne = {
  id: number;
  nom: string;
  resume: string | null;
  secteur: string | null;
  nb_avis: number;
  score: number;
  score_detail: Record<string, unknown>;
  contexte: { faiblesses?: Faiblesses; marche?: Marche | null } | null;
  groupes_avis: { avis: { note: number; titre: string | null; contenu: string; apps: { nom: string } } }[];
};

export async function topOpportunites(limite = 20): Promise<Opportunite[]> {
  const { data, error } = await baseServeur()
    .from("groupes")
    .select("id, nom, resume, secteur, nb_avis, score, score_detail, contexte, groupes_avis(distance, avis(note, titre, contenu, apps(nom)))")
    .order("score", { ascending: false })
    .order("distance", { referencedTable: "groupes_avis" })
    .limit(3, { referencedTable: "groupes_avis" })
    .limit(limite);
  if (error) throw new Error(error.message);
  return (data as unknown as Ligne[]).map((g, i) => ({
    id: g.id,
    rang: i + 1,
    nom: g.nom,
    resume: g.resume,
    secteur: g.secteur,
    nbAvis: g.nb_avis,
    nbApps: Number(g.score_detail.nb_apps ?? 0),
    score: Number(g.score),
    detail: Object.fromEntries(Object.entries(g.score_detail).filter(([, v]) => typeof v === "number")) as Record<string, number>,
    faiblesses: g.contexte?.faiblesses ?? null,
    marche: g.contexte?.marche ?? null,
    citations: g.groupes_avis.map((ga) => ({ note: ga.avis.note, titre: ga.avis.titre, contenu: ga.avis.contenu, app: ga.avis.apps.nom })),
  }));
}

// Ce que l'offre d'une équipe laisse voir du classement : tout le Top 20 en Pro, le lot du jour en gratuit.
export async function opportunitesVisibles(plan: Plan, date = new Date()): Promise<{ visibles: Opportunite[]; total: number }> {
  const classement = await topOpportunites(OFFRES.pro.opportunites);
  const visibles = plan === "pro" ? classement : selectionDuJour(classement, date).sort((a, b) => a.rang - b.rang);
  return { visibles, total: classement.length };
}
