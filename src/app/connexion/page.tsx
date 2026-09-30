import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cheminSur } from "@/lib/comptes";
import { contexte } from "@/lib/serveur/session";
import { CARTE } from "../_ui/styles";

export const metadata: Metadata = { title: "Connexion · Radar" };

const ERREURS: Record<string, string> = {
  refus: "Connexion annulée.",
  code: "Le lien de connexion a expiré. Recommence.",
  depart: "Impossible de joindre le service de connexion. Réessaie dans un instant.",
  email: "Ton compte n'a pas d'adresse email vérifiée : Radar en a besoin.",
  fournisseur: "Mode de connexion inconnu.",
};

export default async function Connexion({ searchParams }: PageProps<"/connexion">) {
  const sp = await searchParams;
  const suivant = cheminSur(sp.suivant);
  if (await contexte()) redirect(suivant);
  const erreur = typeof sp.erreur === "string" ? ERREURS[sp.erreur] : undefined;
  const lien = (fournisseur: string) => `/auth/connexion?${new URLSearchParams({ fournisseur, suivant })}`;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className={`${CARTE} flex w-full max-w-[420px] flex-col gap-5 p-6 md:p-8`}>
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">Connexion à Radar</h1>
          <p className="mt-2 leading-relaxed text-texte-2">
            Des opportunités business tirées des vraies plaintes des clients, vérifiées par un agent enquêteur. Gratuit : 3 opportunités par jour et 1 enquête par semaine.
          </p>
        </div>
        {erreur && (
          <p role="alert" className="rounded-bouton bg-rouge-pale px-3.5 py-2.5 text-sm text-rouge">
            {erreur}
          </p>
        )}
        <div className="flex flex-col gap-2.5">
          <a href={lien("google")} className="flex items-center justify-center gap-3 rounded-bouton border border-bordure bg-surface px-4 py-3 font-semibold text-texte no-underline transition-colors duration-150 ease-radar hover:bg-surface-2">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.7H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.96 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3 2.33C4.67 5.16 6.66 3.58 9 3.58z" />
            </svg>
            Continuer avec Google
          </a>
          <a href={lien("github")} className="flex items-center justify-center gap-3 rounded-bouton bg-nuit px-4 py-3 font-semibold text-white no-underline transition-colors duration-150 ease-radar hover:bg-nuit-2">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Continuer avec GitHub
          </a>
        </div>
        <p className="text-xs leading-relaxed text-doux">
          Radar ne reçoit ni ton mot de passe ni tes contacts : seulement ton nom et ton adresse email. Paiements en mode test uniquement, aucune carte réelle n&apos;est débitée.{" "}
          <a href="/confidentialite" className="font-semibold no-underline">
            Confidentialité
          </a>
        </p>
      </div>
    </main>
  );
}
