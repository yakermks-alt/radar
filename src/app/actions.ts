"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { opportunitesVisibles } from "@/lib/serveur/base";
import { contexte } from "@/lib/serveur/session";
import { ajouterAuSuivi } from "@/lib/serveur/suivi";

// Ajoute une opportunité du classement au suivi de l'équipe. Seulement une opportunité que l'offre
// de l'équipe permet de voir : le numéro envoyé par la page n'est pas pris sur parole.
export async function suivreOpportunite(id: number): Promise<void> {
  const c = await contexte();
  if (!c) return;
  const n = z.number().int().positive().safeParse(id);
  if (!n.success) return;
  const { visibles } = await opportunitesVisibles(c.equipe.plan);
  const o = visibles.find((v) => v.id === n.data);
  if (!o) return;
  await ajouterAuSuivi(c.equipe.id, c.utilisateur.id, { titre: o.nom, resume: o.resume, secteur: o.secteur, score: o.score });
  revalidatePath("/");
}
