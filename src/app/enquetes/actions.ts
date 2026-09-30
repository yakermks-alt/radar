"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { messageErreurBase } from "@/lib/comptes";
import { roleDans } from "@/lib/serveur/comptes";
import { agentLancable, annulerEnquete, creerEnquete, enqueteParJeton, lancerAgent, relancerEnquete } from "@/lib/serveur/enquetes";
import { contexte } from "@/lib/serveur/session";
import { ajouterAuSuivi } from "@/lib/serveur/suivi";

const VERDICTS = { prometteur: "prometteur", a_creuser: "à creuser", decevant: "décevant" } as const;

export type EtatFormulaire = { message: string | null; sujet: string };

const sujet = z
  .string()
  .trim()
  .min(10, "Décris le sujet en quelques mots (10 caractères au moins).")
  .max(200, "200 caractères au maximum.");

// Les quotas (équipe, site) sont vérifiés et réservés d'un seul tenant par la base (reserver_enquete).
export async function lancerEnquete(_: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  const brut = String(form.get("sujet") ?? "");
  const c = await contexte();
  if (!c) return { message: "Ta session a expiré : reconnecte-toi.", sujet: brut };
  const v = sujet.safeParse(brut);
  if (!v.success) return { message: v.error.issues[0].message, sujet: brut };
  if (!agentLancable()) return { message: "Lancement pas encore branché sur ce site (jeton GitHub manquant).", sujet: brut };

  let reservee: { id: number; jeton: string };
  try {
    reservee = await creerEnquete(v.data, c.equipe.id, c.utilisateur.id, c.equipe.plan);
  } catch (e) {
    const message = e instanceof Error ? messageErreurBase(e.message) : null;
    if (message) return { message, sujet: brut };
    throw e;
  }
  let mode: Awaited<ReturnType<typeof lancerAgent>>;
  try {
    mode = await lancerAgent(reservee.id);
  } catch (e) {
    console.error("Lancement de l'agent refusé :", e instanceof Error ? e.message : e);
    mode = "aucun";
  }
  if (mode === "aucun") {
    await annulerEnquete(reservee.id);
    return { message: "L'agent n'a pas pu être lancé. Réessaie dans quelques minutes.", sujet: brut };
  }
  redirect(`/enquete/${reservee.jeton}`);
}

// Relance une enquête interrompue (quota, Gemini saturé…) : elle repart de sa dernière étape.
// Réservé aux membres de l'équipe de l'enquête (le lien seul permet de lire, pas d'agir).
export async function reprendreEnquete(jeton: string): Promise<{ message: string | null }> {
  const c = await contexte();
  if (!c) return { message: "Connecte-toi pour reprendre l'enquête." };
  const trouvee = await enqueteParJeton(jeton);
  if (!trouvee) return { message: "Enquête introuvable." };
  const { enquete } = trouvee;
  const autorise = c.utilisateur.admin || (enquete.equipe_id !== null && (await roleDans(enquete.equipe_id, c.utilisateur.id)) !== null);
  if (!autorise) return { message: "Seule l'équipe qui a lancé cette enquête peut la reprendre." };
  if (enquete.statut !== "en_cours" && enquete.statut !== "en_attente") return { message: "Cette enquête n'est plus en cours." };
  if (enquete.erreur === null) return { message: "L'enquête tourne déjà." };
  await relancerEnquete(enquete.id);
  const mode = await lancerAgent(enquete.id).catch(() => "aucun" as const);
  if (mode === "aucun") return { message: "L'agent n'a pas pu être relancé. Réessaie dans quelques minutes." };
  redirect(`/enquete/${jeton}`);
}

// Ajoute l'enquête (terminée) au tableau de suivi de l'équipe active.
export async function suivreEnquete(jeton: string): Promise<{ message: string | null }> {
  const c = await contexte();
  if (!c) return { message: "Connecte-toi pour ajouter cette enquête au suivi." };
  const trouvee = await enqueteParJeton(jeton);
  const rapport = trouvee?.enquete.rapport;
  if (!trouvee || !rapport) return { message: "Le rapport n'est pas encore prêt." };
  const { enquete } = trouvee;
  await ajouterAuSuivi(c.equipe.id, c.utilisateur.id, {
    titre: enquete.sujet,
    resume: `Verdict de l'enquête : ${VERDICTS[rapport.verdict]}.`,
    enqueteId: enquete.equipe_id === c.equipe.id ? enquete.id : null,
  });
  redirect("/suivi");
}
