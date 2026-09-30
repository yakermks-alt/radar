"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { OFFRES, SECTEURS_MAX } from "@/lib/offres";
import { reglerEmails, supprimerCompte } from "@/lib/serveur/comptes";
import { clientSession, exigerContexte } from "@/lib/serveur/session";

export async function enregistrerEmails(form: FormData): Promise<void> {
  const c = await exigerContexte("/compte");
  const secteurs = form
    .getAll("secteurs")
    .map(String)
    .filter((s) => /^[a-z0-9_-]{1,40}$/.test(s))
    .slice(0, SECTEURS_MAX);
  // Les alertes par secteur sont réservées à l'offre Pro : en gratuit, on n'enregistre rien.
  await reglerEmails(c.utilisateur.id, form.get("email_matin") === "oui", OFFRES[c.equipe.plan].alertes ? secteurs : []);
  revalidatePath("/compte");
  redirect("/compte?enregistre=1");
}

export async function seDeconnecter(): Promise<void> {
  const supabase = await clientSession();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/connexion");
}

export async function supprimer(form: FormData): Promise<void> {
  const c = await exigerContexte("/compte");
  if (!z.literal("SUPPRIMER").safeParse(String(form.get("confirmation") ?? "").trim()).success) {
    redirect(`/compte?${new URLSearchParams({ erreur: "Écris SUPPRIMER pour confirmer." })}`);
  }
  try {
    await supprimerCompte(c.utilisateur.id);
  } catch (e) {
    unstable_rethrow(e);
    redirect(`/compte?${new URLSearchParams({ erreur: e instanceof Error ? e.message.slice(0, 200) : "Suppression impossible." })}`);
  }
  const supabase = await clientSession();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/connexion");
}
