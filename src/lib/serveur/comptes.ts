import "server-only";
import { OFFRES, type Plan } from "../offres";
import { baseServeur } from "./base";

// Équipes, membres et invitations. Chaque fonction reçoit l'identité déjà vérifiée par la session
// (contexte()) et contrôle elle-même les droits : rien ne se fie à ce que la page envoie.

export type Membre = { id: string; email: string; nom: string | null; role: "proprietaire" | "membre"; depuis: string };
export type Invitation = { jeton: string; usages: number; usagesMax: number; expireLe: string };
export type EquipeListee = { id: number; nom: string; plan: Plan; role: "proprietaire" | "membre" };

function verifier<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

export async function roleDans(equipe: number, utilisateur: string): Promise<"proprietaire" | "membre" | null> {
  const r = await baseServeur().from("membres").select("role").eq("equipe_id", equipe).eq("utilisateur_id", utilisateur).maybeSingle<{ role: "proprietaire" | "membre" }>();
  return verifier(r)?.role ?? null;
}

export async function equipesDe(utilisateur: string): Promise<EquipeListee[]> {
  const r = await baseServeur()
    .from("membres")
    .select("role, equipes(id, nom, plan)")
    .eq("utilisateur_id", utilisateur)
    .order("cree_le")
    .returns<{ role: "proprietaire" | "membre"; equipes: { id: number; nom: string; plan: Plan } }[]>();
  return (verifier(r) ?? []).map((m) => ({ ...m.equipes, role: m.role }));
}

export async function membresDe(equipe: number): Promise<Membre[]> {
  const r = await baseServeur()
    .from("membres")
    .select("role, cree_le, profils(id, email, nom)")
    .eq("equipe_id", equipe)
    .order("cree_le")
    .returns<{ role: "proprietaire" | "membre"; cree_le: string; profils: { id: string; email: string; nom: string | null } }[]>();
  return (verifier(r) ?? []).map((m) => ({ ...m.profils, role: m.role, depuis: m.cree_le }));
}

export async function invitationsDe(equipe: number): Promise<Invitation[]> {
  const r = await baseServeur()
    .from("invitations")
    .select("jeton, usages, usages_max, expire_le")
    .eq("equipe_id", equipe)
    .gt("expire_le", new Date().toISOString())
    .order("cree_le", { ascending: false })
    .returns<{ jeton: string; usages: number; usages_max: number; expire_le: string }[]>();
  return (verifier(r) ?? []).filter((i) => i.usages < i.usages_max).map((i) => ({ jeton: i.jeton, usages: i.usages, usagesMax: i.usages_max, expireLe: i.expire_le }));
}

// Seul un propriétaire invite ; au plus 3 liens valides à la fois (un lien fuité se révoque).
export async function creerInvitation(equipe: number, par: string): Promise<string> {
  if ((await roleDans(equipe, par)) !== "proprietaire") throw new Error("Seul le propriétaire de l'équipe peut inviter.");
  if ((await invitationsDe(equipe)).length >= 3) throw new Error("3 liens d'invitation valides au maximum : supprime-en un d'abord.");
  const r = await baseServeur().from("invitations").insert({ equipe_id: equipe, cree_par: par }).select("jeton").single<{ jeton: string }>();
  const cree = verifier(r);
  if (!cree) throw new Error("Invitation non créée.");
  return cree.jeton;
}

export async function supprimerInvitation(equipe: number, par: string, jeton: string): Promise<void> {
  if ((await roleDans(equipe, par)) !== "proprietaire") throw new Error("Seul le propriétaire de l'équipe peut gérer les invitations.");
  verifier(await baseServeur().from("invitations").delete().eq("equipe_id", equipe).eq("jeton", jeton));
}

// Aperçu d'une invitation avant de la rejoindre (nom de l'équipe), sans rien consommer.
export async function apercuInvitation(jeton: string): Promise<{ equipe: string; valide: boolean } | null> {
  const r = await baseServeur()
    .from("invitations")
    .select("usages, usages_max, expire_le, equipes(nom)")
    .eq("jeton", jeton)
    .maybeSingle<{ usages: number; usages_max: number; expire_le: string; equipes: { nom: string } }>();
  const i = verifier(r);
  if (!i) return null;
  return { equipe: i.equipes.nom, valide: i.usages < i.usages_max && new Date(i.expire_le) > new Date() };
}

export async function rejoindre(jeton: string, utilisateur: string): Promise<void> {
  const { error } = await baseServeur().rpc("rejoindre_equipe", {
    p_jeton: jeton,
    p_utilisateur: utilisateur,
    p_max_gratuit: OFFRES.gratuit.membres,
    p_max_pro: OFFRES.pro.membres,
  });
  if (error) throw new Error(error.message);
}

export async function changerEquipe(utilisateur: string, equipe: number): Promise<void> {
  if (!(await roleDans(equipe, utilisateur))) throw new Error("Tu ne fais pas partie de cette équipe.");
  verifier(await baseServeur().from("profils").update({ equipe_active: equipe }).eq("id", utilisateur));
}

export async function renommerEquipe(equipe: number, par: string, nom: string): Promise<void> {
  if ((await roleDans(equipe, par)) !== "proprietaire") throw new Error("Seul le propriétaire peut renommer l'équipe.");
  verifier(await baseServeur().from("equipes").update({ nom }).eq("id", equipe));
}

export async function retirerMembre(equipe: number, par: string, membre: string): Promise<void> {
  if (par !== membre && (await roleDans(equipe, par)) !== "proprietaire") throw new Error("Seul le propriétaire peut retirer un membre.");
  const { error } = await baseServeur().rpc("quitter_equipe", { p_equipe: equipe, p_utilisateur: membre });
  if (error) throw new Error(error.message);
}

export async function reglerEmails(utilisateur: string, emailMatin: boolean, secteurs: string[]): Promise<void> {
  verifier(await baseServeur().from("profils").update({ email_matin: emailMatin, secteurs }).eq("id", utilisateur));
}

// Suppression du compte : la personne quitte chaque équipe (passage de main ou suppression d'une
// équipe vide, refusée si un abonnement court encore), puis son compte Supabase est supprimé, ce qui
// efface en cascade profil et envois d'emails. Ses enquêtes restent à l'équipe, sans auteur.
export async function supprimerCompte(utilisateur: string): Promise<void> {
  const db = baseServeur();
  const equipes = await equipesDe(utilisateur);
  // Vérifié avant de toucher à quoi que ce soit, pour ne pas s'arrêter à mi-chemin.
  for (const e of equipes.filter((e) => e.plan === "pro")) {
    if ((await membresDe(e.id)).length === 1) throw new Error(`Résilie d'abord l'abonnement Pro de « ${e.nom} » (page Équipe).`);
  }
  for (const e of equipes) {
    const { error } = await db.rpc("quitter_equipe", { p_equipe: e.id, p_utilisateur: utilisateur });
    if (error) throw new Error(error.message);
  }
  const { error } = await db.auth.admin.deleteUser(utilisateur);
  if (error) throw new Error(error.message);
}
