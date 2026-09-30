import "server-only";
import { baseServeur } from "./base";

// Tableau « à valider » d'une équipe : les opportunités retenues et où elles en sont.

export const STATUTS_SUIVI = [
  { id: "a_creuser", libelle: "À creuser" },
  { id: "entretien", libelle: "Entretien fait" },
  { id: "abandonnee", libelle: "Abandonnée" },
  { id: "lancee", libelle: "On se lance" },
] as const;
export type StatutSuivi = (typeof STATUTS_SUIVI)[number]["id"];

export type ElementSuivi = {
  id: number;
  titre: string;
  resume: string | null;
  secteur: string | null;
  score: number | null;
  statut: StatutSuivi;
  note: string | null;
  enquete: { jeton: string; statut: string; erreur: string | null; verdict: string | null } | null;
  maj_le: string;
};

export async function suiviDe(equipe: number): Promise<ElementSuivi[]> {
  const { data, error } = await baseServeur()
    .from("suivi")
    .select("id, titre, resume, secteur, score, statut, note, maj_le, enquetes(jeton, statut, erreur, verdict:rapport->>verdict)")
    .eq("equipe_id", equipe)
    .order("maj_le", { ascending: false })
    .returns<(Omit<ElementSuivi, "enquete"> & { enquetes: ElementSuivi["enquete"] })[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map(({ enquetes, score, ...e }) => ({ ...e, score: score === null ? null : Number(score), enquete: enquetes }));
}

export async function titresSuivis(equipe: number): Promise<Set<string>> {
  const { data, error } = await baseServeur().from("suivi").select("titre").eq("equipe_id", equipe).returns<{ titre: string }[]>();
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((d) => d.titre));
}

// Ajout (sans doublon : un même titre met simplement l'élément à jour).
export async function ajouterAuSuivi(
  equipe: number,
  par: string,
  e: { titre: string; resume?: string | null; secteur?: string | null; score?: number | null; enqueteId?: number | null },
): Promise<void> {
  const { error } = await baseServeur()
    .from("suivi")
    .upsert(
      {
        equipe_id: equipe,
        ajoute_par: par,
        titre: e.titre.slice(0, 200),
        resume: e.resume?.slice(0, 600) ?? null,
        secteur: e.secteur?.slice(0, 40) ?? null,
        score: e.score ?? null,
        ...(e.enqueteId ? { enquete_id: e.enqueteId } : {}),
        maj_le: new Date().toISOString(),
      },
      { onConflict: "equipe_id,titre" },
    );
  if (error) throw new Error(error.message);
}

// Toujours filtré par équipe : on ne modifie jamais l'élément d'une autre équipe, même avec son numéro.
export async function modifierSuivi(equipe: number, id: number, champs: { statut?: StatutSuivi; note?: string | null }): Promise<void> {
  const { error } = await baseServeur()
    .from("suivi")
    .update({ ...champs, maj_le: new Date().toISOString() })
    .eq("equipe_id", equipe)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function retirerDuSuivi(equipe: number, id: number): Promise<void> {
  const { error } = await baseServeur().from("suivi").delete().eq("equipe_id", equipe).eq("id", id);
  if (error) throw new Error(error.message);
}
