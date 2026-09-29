"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { agentLancable, creerEnquete, enqueteParJeton, enquetesDuJour, ENQUETES_PAR_JOUR, lancerAgent, relancerEnquete } from "@/lib/serveur/enquetes";

export type EtatFormulaire = { message: string | null; sujet: string };

const sujet = z
  .string()
  .trim()
  .min(10, "Décris le sujet en quelques mots (10 caractères au moins).")
  .max(200, "200 caractères au maximum.");

// Comparaison en temps constant (empreintes de même longueur), pour ne rien laisser deviner.
function codeValide(recu: string, attendu: string): boolean {
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(recu), h(attendu));
}

// Tant qu'il n'y a pas de comptes (phase 6), un code d'accès protège les quotas gratuits.
// Obligatoire en ligne ; facultatif en local. Renvoie un message d'erreur, ou null si c'est bon.
function refusAcces(form: FormData): string | null {
  const attendu = process.env.RADAR_CODE_ACCES;
  if (!attendu && process.env.NODE_ENV === "production") return "Lancement désactivé : aucun code d'accès configuré.";
  if (attendu && !codeValide(String(form.get("code") ?? ""), attendu)) return "Code d'accès incorrect.";
  return null;
}

export async function lancerEnquete(_: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  const brut = String(form.get("sujet") ?? "");
  const v = sujet.safeParse(brut);
  if (!v.success) return { message: v.error.issues[0].message, sujet: brut };
  const refus = refusAcces(form);
  if (refus) return { message: refus, sujet: brut };
  if (!agentLancable()) return { message: "Lancement pas encore branché sur ce site (jeton GitHub manquant).", sujet: brut };

  if ((await enquetesDuJour()) >= ENQUETES_PAR_JOUR) {
    return { message: `Limite de ${ENQUETES_PAR_JOUR} enquêtes par jour atteinte (offre gratuite des services utilisés). Reviens demain.`, sujet: brut };
  }

  const { id, jeton } = await creerEnquete(v.data);
  const mode = await lancerAgent(id);
  if (mode === "aucun") return { message: "Enquête enregistrée, mais aucun moyen de lancer l'agent ici.", sujet: brut };
  redirect(`/enquete/${jeton}`);
}

// Relance une enquête interrompue (quota, Gemini saturé…) : elle repart de sa dernière étape.
export async function reprendreEnquete(jeton: string, _: { message: string | null }, form: FormData): Promise<{ message: string | null }> {
  const refus = refusAcces(form);
  if (refus) return { message: refus };
  const trouvee = await enqueteParJeton(jeton);
  if (!trouvee) return { message: "Enquête introuvable." };
  const { enquete } = trouvee;
  if (enquete.statut !== "en_cours" && enquete.statut !== "en_attente") return { message: "Cette enquête n'est plus en cours." };
  if (enquete.erreur === null) return { message: "L'enquête tourne déjà." };
  await relancerEnquete(enquete.id);
  const mode = await lancerAgent(enquete.id);
  if (mode === "aucun") return { message: "Aucun moyen de lancer l'agent ici." };
  redirect(`/enquete/${jeton}`);
}
