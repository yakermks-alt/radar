import { NextResponse, type NextRequest } from "next/server";
import { cheminSur } from "@/lib/comptes";
import { adresseSite } from "@/lib/env";
import { clientSession } from "@/lib/serveur/session";

// Départ vers Google ou GitHub. Lien simple (GET) plutôt que formulaire : la CSP (form-action 'self')
// bloquerait la redirection d'un formulaire vers un autre site. Supabase utilise PKCE : le code de
// retour ne sert qu'au navigateur qui a commencé la connexion.
const FOURNISSEURS = new Set(["google", "github"]);

export async function GET(requete: NextRequest) {
  const fournisseur = requete.nextUrl.searchParams.get("fournisseur") ?? "";
  if (!FOURNISSEURS.has(fournisseur)) return NextResponse.redirect(new URL("/connexion?erreur=fournisseur", adresseSite()));
  const suivant = cheminSur(requete.nextUrl.searchParams.get("suivant"));
  const supabase = await clientSession();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: fournisseur as "google" | "github",
    options: { redirectTo: `${adresseSite()}/auth/retour?${new URLSearchParams({ suivant })}`, skipBrowserRedirect: true },
  });
  if (error || !data.url) return NextResponse.redirect(new URL("/connexion?erreur=depart", adresseSite()));
  return NextResponse.redirect(data.url);
}
