import { z } from "zod";

// Variables lisibles côté navigateur (clés publiques uniquement).
const publiques = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith("sb_publishable_"),
});

// Variables réservées au serveur et aux tâches automatiques.
const serveur = publiques.extend({
  SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_"),
  GEMINI_API_KEY: z.string().min(20),
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
