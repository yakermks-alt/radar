import type { Metadata } from "next";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";
import { messageErreurBase } from "@/lib/comptes";
import { apercuInvitation, rejoindre } from "@/lib/serveur/comptes";
import { contexte } from "@/lib/serveur/session";
import { BOUTON_PRINCIPAL, CARTE } from "../../_ui/styles";

export const metadata: Metadata = { title: "Invitation · Radar" };

// Rejoindre une équipe : l'invitation n'est consommée qu'au clic, par une personne connectée.
async function accepter(jeton: string): Promise<void> {
  "use server";
  const c = await contexte();
  if (!c) redirect(`/connexion?${new URLSearchParams({ suivant: `/rejoindre/${jeton}` })}`);
  try {
    await rejoindre(jeton, c.utilisateur.id);
  } catch (e) {
    unstable_rethrow(e);
    redirect(`/rejoindre/${jeton}?${new URLSearchParams({ erreur: messageErreurBase(e instanceof Error ? e.message : "") ?? "Impossible de rejoindre cette équipe." })}`);
  }
  redirect("/equipe");
}

export default async function Rejoindre({ params, searchParams }: PageProps<"/rejoindre/[jeton]">) {
  await connection();
  const { jeton } = await params;
  const { erreur } = await searchParams;
  if (!z.uuid().safeParse(jeton).success) notFound();
  const [apercu, c] = await Promise.all([apercuInvitation(jeton), contexte()]);
  if (!apercu) notFound();

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className={`${CARTE} flex w-full max-w-[420px] flex-col gap-4 p-6 md:p-8`}>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Rejoindre « {apercu.equipe} »</h1>
        {typeof erreur === "string" && (
          <p role="alert" className="rounded-bouton bg-rouge-pale px-3.5 py-2.5 text-sm text-rouge">
            {erreur.slice(0, 200)}
          </p>
        )}
        {!apercu.valide ? (
          <p className="text-texte-2">Ce lien d&apos;invitation a expiré ou a déjà servi autant de fois que prévu. Demande-en un nouveau à la personne qui te l&apos;a envoyé.</p>
        ) : c ? (
          <>
            <p className="leading-relaxed text-texte-2">
              Tu partageras le classement, les enquêtes et le tableau de suivi de cette équipe. Tu gardes aussi tes autres équipes (page Équipe).
            </p>
            <form action={accepter.bind(null, jeton)}>
              <button type="submit" className={`${BOUTON_PRINCIPAL} w-full py-3`}>
                Rejoindre l&apos;équipe
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="leading-relaxed text-texte-2">Connecte-toi d&apos;abord (Google ou GitHub), tu reviendras ici ensuite.</p>
            <a href={`/connexion?${new URLSearchParams({ suivant: `/rejoindre/${jeton}` })}`} className={`${BOUTON_PRINCIPAL} w-full py-3 no-underline`}>
              Se connecter
            </a>
          </>
        )}
      </div>
    </main>
  );
}
