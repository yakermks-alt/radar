import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rafraîchit la session Supabase à chaque requête et renvoie vers /connexion si personne n'est
// connecté. Pages ouvertes : connexion et retour de Google/GitHub, rapports d'enquête (adresse
// secrète, partageable), webhook Stripe (signé), invitations (qui renvoient elles-mêmes à la connexion),
// politique de confidentialité.
const OUVERTES = ["/connexion", "/auth", "/enquete", "/api/stripe", "/rejoindre", "/confidentialite"];

export async function proxy(requete: NextRequest) {
  let reponse = NextResponse.next({ request: requete });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => requete.cookies.getAll(),
      setAll: (liste) => {
        for (const { name, value } of liste) requete.cookies.set(name, value);
        reponse = NextResponse.next({ request: requete });
        for (const { name, value, options } of liste) reponse.cookies.set(name, value, options);
      },
    },
  });
  // getClaims : jeton vérifié sur place avec la clé publique de Supabase (ES256, gardée en mémoire),
  // et rafraîchi s'il a expiré. Un aller-retour réseau de moins que getUser à chaque page.
  const { data } = await supabase.auth.getClaims();
  const connecte = Boolean(data?.claims?.sub);

  const chemin = requete.nextUrl.pathname;
  if (!connecte && !OUVERTES.some((p) => chemin === p || chemin.startsWith(`${p}/`))) {
    const url = requete.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = chemin === "/" ? "" : `?${new URLSearchParams({ suivant: chemin + requete.nextUrl.search })}`;
    const redirection = NextResponse.redirect(url);
    for (const c of reponse.cookies.getAll()) redirection.cookies.set(c);
    return redirection;
  }
  return reponse;
}

export const config = {
  // Tout sauf les fichiers statiques et le webhook Stripe (le corps brut doit arriver intact).
  matcher: ["/((?!_next/|favicon\\.ico|api/stripe).*)"],
};
