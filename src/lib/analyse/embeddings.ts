// Embeddings calculés en local (aucun quota) avec un modèle open source multilingue spécialisé
// dans les paraphrases : deux phrases de même sens donnent des vecteurs proches.
// 384 dimensions, vecteurs normalisés (le produit scalaire vaut la similarité cosinus).
import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

export const MODELE_EMBEDDINGS = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
export const DIMENSIONS = 384;

let extracteur: Promise<FeatureExtractionPipeline> | null = null;

export async function vectoriser(textes: string[]): Promise<number[][]> {
  extracteur ??= pipeline("feature-extraction", MODELE_EMBEDDINGS, { dtype: "q8" });
  const f = await extracteur;
  const sortie = await f(textes, { pooling: "mean", normalize: true });
  const vecteurs = sortie.tolist() as number[][];
  if (vecteurs.some((v) => v.length !== DIMENSIONS)) throw new Error("Taille d'embedding inattendue");
  return vecteurs;
}

// Format texte attendu par pgvector, arrondi pour alléger les échanges.
export const versPgvector = (v: number[]) => `[${v.map((x) => x.toFixed(6)).join(",")}]`;

export const depuisPgvector = (s: string): number[] => JSON.parse(s) as number[];
