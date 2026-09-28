// Accès serveur à la base pour les tâches automatiques (clé secrète) et journal des passages.
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const env = z
  .object({ NEXT_PUBLIC_SUPABASE_URL: z.url(), SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_") })
  .parse(process.env);

export const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

// Les réponses Supabase sont { data, error } : on lève l'erreur, on renvoie data non nul.
export async function verifier<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<Exclude<T, null>> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("Réponse vide de la base");
  return data as Exclude<T, null>;
}

export async function sansErreur(p: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await p;
  if (error) throw new Error(error.message);
}

export type Tache = "collecte" | "analyse" | "embeddings" | "regroupement";

// Ouvre une ligne de journal, exécute la tâche, puis la ferme avec son bilan (ok ou erreur).
export async function avecJournal<B extends Record<string, unknown>>(
  tache: Tache,
  travail: (bilan: B) => Promise<"ok" | "erreur">,
  bilan: B,
): Promise<void> {
  const ligne: { id: number } = await verifier(db.from("journal").insert({ tache }).select("id").single());
  try {
    const statut = await travail(bilan);
    await sansErreur(db.from("journal").update({ statut, termine_le: new Date().toISOString(), details: bilan }).eq("id", ligne.id));
    if (statut === "erreur") process.exitCode = 1;
  } catch (e) {
    const erreur = e instanceof Error ? e.message : String(e);
    await db.from("journal").update({ statut: "erreur", termine_le: new Date().toISOString(), details: bilan, erreur }).eq("id", ligne.id);
    throw e;
  }
}

// Lit une requête page par page (l'API renvoie 1 000 lignes au maximum par appel).
export async function toutLire<T>(requete: (debut: number, fin: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const tout: T[] = [];
  for (let debut = 0; ; debut += 1000) {
    const page = await verifier(requete(debut, debut + 999));
    tout.push(...(page as T[]));
    if ((page as T[]).length < 1000) return tout;
  }
}
