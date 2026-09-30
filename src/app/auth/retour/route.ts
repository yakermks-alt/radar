import { NextResponse, type NextRequest } from "next/server";
import { cheminSur } from "@/lib/comptes";
import { adresseSite } from "@/lib/env";
import { actualiserProfil, clientSession, contexte } from "@/lib/serveur/session";

// Retour de Google ou GitHub : le code est échangé contre une session (cookies), puis le profil et
// l'équipe personnelle sont créés si c'est la première fois (contexte()).
export async function GET(requete: NextRequest) {
  const code = requete.nextUrl.searchParams.get("code");
  const suivant = cheminSur(requete.nextUrl.searchParams.get("suivant"));
  if (!code) return NextResponse.redirect(new URL("/connexion?erreur=refus", adresseSite()));
  const supabase = await clientSession();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/connexion?erreur=code", adresseSite()));
  await actualiserProfil();
  if (!(await contexte())) return NextResponse.redirect(new URL("/connexion?erreur=email", adresseSite()));
  return NextResponse.redirect(new URL(suivant, adresseSite()));
}
