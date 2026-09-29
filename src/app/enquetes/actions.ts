"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { creerEnquete, enquetesDuJour, ENQUETES_PAR_JOUR, lancerAgent } from "@/lib/serveur/enquetes";

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

export async function lancerEnquete(_: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  const brut = String(form.get("sujet") ?? "");
  const v = sujet.safeParse(brut);
  if (!v.success) return { message: v.error.issues[0].message, sujet: brut };

  // Tant qu'il n'y a pas de comptes (phase 6), un code d'accès protège les quotas gratuits.
  // Obligatoire en ligne ; facultatif en local.
  const attendu = process.env.RADAR_CODE_ACCES;
  if (!attendu && process.env.NODE_ENV === "production") return { message: "Lancement désactivé : aucun code d'accès configuré.", sujet: brut };
  if (attendu && !codeValide(String(form.get("code") ?? ""), attendu)) return { message: "Code d'accès incorrect.", sujet: brut };

  if ((await enquetesDuJour()) >= ENQUETES_PAR_JOUR) {
    return { message: `Limite de ${ENQUETES_PAR_JOUR} enquêtes par jour atteinte (offre gratuite des services utilisés). Reviens demain.`, sujet: brut };
  }

  const { id, jeton } = await creerEnquete(v.data);
  const mode = await lancerAgent(id);
  if (mode === "aucun") return { message: "Enquête enregistrée, mais aucun moyen de lancer l'agent ici.", sujet: brut };
  redirect(`/enquete/${jeton}`);
}
