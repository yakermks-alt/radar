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
