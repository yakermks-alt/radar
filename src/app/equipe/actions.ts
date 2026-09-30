"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { messageErreurBase } from "@/lib/comptes";
import { changerEquipe, creerInvitation, renommerEquipe, retirerMembre, supprimerInvitation } from "@/lib/serveur/comptes";
import { lienPaiement, lienPortail } from "@/lib/serveur/paiement";
import { exigerContexte } from "@/lib/serveur/session";

// Chaque action relit la session et laisse les fonctions serveur vérifier les droits (propriétaire…).
// Un refus revient sur la page avec un message lisible.
function retour(message: string): never {
  redirect(`/equipe?${new URLSearchParams({ message })}`);
}

async function tenter(f: () => Promise<void>): Promise<void> {
  try {
    await f();
  } catch (e) {
    unstable_rethrow(e); // redirections de Next : ce ne sont pas des erreurs
    const brut = e instanceof Error ? e.message : String(e);
    retour(messageErreurBase(brut) ?? brut.slice(0, 200));
  }
  revalidatePath("/equipe");
}

export async function inviter(): Promise<void> {
  const c = await exigerContexte("/equipe");
  await tenter(async () => {
    await creerInvitation(c.equipe.id, c.utilisateur.id);
  });
}

export async function supprimerLien(jeton: string): Promise<void> {
  const c = await exigerContexte("/equipe");
  if (!z.uuid().safeParse(jeton).success) return;
  await tenter(() => supprimerInvitation(c.equipe.id, c.utilisateur.id, jeton));
}

export async function renommer(form: FormData): Promise<void> {
  const c = await exigerContexte("/equipe");
  const nom = z.string().trim().min(1).max(60).safeParse(form.get("nom"));
  if (!nom.success) retour("Le nom de l'équipe doit faire entre 1 et 60 caractères.");
  await tenter(() => renommerEquipe(c.equipe.id, c.utilisateur.id, nom.data));
}

export async function retirer(membre: string): Promise<void> {
  const c = await exigerContexte("/equipe");
  if (!z.uuid().safeParse(membre).success) return;
  await tenter(() => retirerMembre(c.equipe.id, c.utilisateur.id, membre));
}

// Quitter l'équipe active : on bascule ensuite sur une autre (ou une nouvelle équipe personnelle).
export async function quitter(): Promise<void> {
  const c = await exigerContexte("/equipe");
  await tenter(() => retirerMembre(c.equipe.id, c.utilisateur.id, c.utilisateur.id));
  redirect("/");
}

export async function basculer(form: FormData): Promise<void> {
  const c = await exigerContexte("/equipe");
  const id = z.coerce.number().int().positive().safeParse(form.get("equipe"));
  if (!id.success) return;
  await tenter(() => changerEquipe(c.utilisateur.id, id.data));
  redirect("/equipe");
}

export async function passerPro(): Promise<void> {
  const c = await exigerContexte("/equipe");
  if (c.equipe.role !== "proprietaire") retour("Seul le propriétaire de l'équipe peut changer d'offre.");
  if (c.equipe.plan === "pro") retour("Ton équipe est déjà en Pro.");
  let url = "";
  await tenter(async () => {
    url = await lienPaiement(c.equipe, c.utilisateur.email);
  });
  redirect(url);
}

export async function gererAbonnement(): Promise<void> {
  const c = await exigerContexte("/equipe");
  if (c.equipe.role !== "proprietaire" || !c.equipe.stripeClient) retour("Seul le propriétaire de l'équipe gère l'abonnement.");
  let url = "";
  await tenter(async () => {
    url = await lienPortail(c.equipe.stripeClient!);
  });
  redirect(url);
}
