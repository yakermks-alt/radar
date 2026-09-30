import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { nomAffiche } from "../comptes";
import type { Plan } from "../offres";
import { envPublique } from "../env";
import { baseServeur } from "./base";

// Client Supabase lié aux cookies de la personne : sert seulement à l'authentification (connexion,
// session, déconnexion). Les données sont lues avec la clé serveur, après vérification de la session.
export async function clientSession() {
  const env = envPublique();
  const magasin = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => magasin.getAll(),
      setAll: (liste) => {
        try {
          for (const { name, value, options } of liste) magasin.set(name, value, options);
        } catch {
          // Appelé pendant le rendu d'une page : le proxy a déjà rafraîchi la session.
        }
      },
    },
  });
}

export type Contexte = {
  utilisateur: { id: string; email: string; nom: string | null; admin: boolean; emailMatin: boolean; secteurs: string[] };
  equipe: { id: number; nom: string; plan: Plan; role: "proprietaire" | "membre"; abonnementStatut: string | null; finPeriode: string | null; stripeClient: string | null };
};

type LigneProfil = {
  id: string;
  email: string;
  nom: string | null;
  admin: boolean;
  email_matin: boolean;
  secteurs: string[];
  equipe_active: number | null;
  membres: {
    role: "proprietaire" | "membre";
    equipe_id: number;
    equipes: { id: number; nom: string; plan: Plan; abonnement_statut: string | null; fin_periode: string | null; stripe_client: string | null };
  }[];
};

const PROFIL = "id, email, nom, admin, email_matin, secteurs, equipe_active, membres(role, equipe_id, equipes(id, nom, plan, abonnement_statut, fin_periode, stripe_client))";

// Personne connectée et son équipe active, ou null. Le jeton est vérifié sur place (getClaims :
// signature ES256 de Supabase, date d'expiration) ; profil, adhésion et équipe arrivent en une seule
// requête. Mis en cache pour la durée d'une requête.
export const contexte = cache(async (): Promise<Contexte | null> => {
  const supabase = await clientSession();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || typeof claims.email !== "string" || !claims.email) return null;

  const db = baseServeur();
  const lire = async () => (await db.from("profils").select(PROFIL).eq("id", claims.sub).maybeSingle<LigneProfil>()).data;
  let profil = await lire();
  let membre = profil?.membres.find((m) => m.equipe_id === profil?.equipe_active);
  if (!profil || !membre) {
    // Première visite après connexion, ou équipe quittée : profil et équipe (re)créés.
    const { error } = await db.rpc("premiere_connexion", { p_id: claims.sub, p_email: claims.email, p_nom: nomAffiche(claims.user_metadata as Record<string, unknown> | undefined) });
    if (error) throw new Error(error.message);
    profil = await lire();
    membre = profil?.membres.find((m) => m.equipe_id === profil?.equipe_active);
  }
  if (!profil || !membre) return null;

  return {
    utilisateur: { id: profil.id, email: profil.email, nom: profil.nom, admin: profil.admin, emailMatin: profil.email_matin, secteurs: profil.secteurs },
    equipe: {
      id: membre.equipes.id,
      nom: membre.equipes.nom,
      plan: membre.equipes.plan,
      role: membre.role,
      abonnementStatut: membre.equipes.abonnement_statut,
      finPeriode: membre.equipes.fin_periode,
      stripeClient: membre.equipes.stripe_client,
    },
  };
});

// Pour les pages et actions réservées : renvoie vers la connexion si personne n'est connecté.
export async function exigerContexte(retour = "/"): Promise<Contexte> {
  const c = await contexte();
  if (!c) redirect(`/connexion?${new URLSearchParams({ suivant: retour })}`);
  return c;
}

// À chaque connexion : email et nom à jour (ils peuvent changer chez Google ou GitHub), date de visite.
export async function actualiserProfil(): Promise<void> {
  const supabase = await clientSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return;
  const { error } = await baseServeur().rpc("premiere_connexion", { p_id: user.id, p_email: user.email, p_nom: nomAffiche(user.user_metadata) });
  if (error) throw new Error(error.message);
}
