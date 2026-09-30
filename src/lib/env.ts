import { z } from "zod";

// Variables lisibles côté navigateur (clés publiques uniquement).
const publiques = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith("sb_publishable_"),
});

// Variables réservées au serveur du site. Pas de clé Gemini, Tavily ni Insee : l'agent tourne sur
// GitHub, le site n'en a pas besoin (moindre privilège, rien de plus à voler sur Netlify).
const serveur = publiques.extend({
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_"),
});

export function envPublique() {
  return publiques.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function envServeur() {
  return serveur.parse(process.env);
}

// Paiement (phase 6) : Stripe en mode test uniquement. Une clé « live » est refusée d'office.
const stripe = z.object({
  STRIPE_SECRET_KEY: z.string().startsWith("sk_test_", "Radar n'accepte que les clés Stripe de test"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  STRIPE_PRIX_PRO: z.string().startsWith("price_"),
});

export function envStripe() {
  const r = stripe.safeParse(process.env);
  return r.success ? r.data : null; // pas encore configuré : les boutons de paiement sont masqués
}

// Adresse publique du site (retours de connexion et de paiement). Netlify fournit URL en production.
export function adresseSite(): string {
  const brute = process.env.SITE_URL ?? process.env.URL ?? "http://localhost:3000";
  return z.url().parse(brute).replace(/\/$/, "");
}
