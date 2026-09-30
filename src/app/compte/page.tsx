import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { OFFRES } from "@/lib/offres";
import { baseServeur } from "@/lib/serveur/base";
import { exigerContexte } from "@/lib/serveur/session";
import { BarreHaut } from "../_ui/BarreHaut";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, CARTE, CHAMP } from "../_ui/styles";
import { libelleSecteur } from "../_ui/sujet";
import { enregistrerEmails, seDeconnecter, supprimer } from "./actions";

export const metadata: Metadata = { title: "Mon compte · Radar" };

export default async function Compte({ searchParams }: PageProps<"/compte">) {
  const sp = await searchParams;
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <BarreHaut chemin={[{ libelle: "Mon compte" }]} />
      <div className="flex justify-center px-4 py-5 md:px-7 md:py-8">
        <div className="flex w-full max-w-[720px] flex-col gap-4">
          <Suspense fallback={<p className="text-doux">Chargement…</p>}>
            <Contenu enregistre={sp.enregistre === "1"} erreur={typeof sp.erreur === "string" ? sp.erreur.slice(0, 200) : null} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function Contenu({ enregistre, erreur }: { enregistre: boolean; erreur: string | null }) {
  await connection();
  const c = await exigerContexte("/compte");
  const { data } = await baseServeur().from("groupes").select("secteur").not("secteur", "is", null).returns<{ secteur: string }[]>();
  const secteurs = [...new Set((data ?? []).map((d) => d.secteur))].sort();
  const alertes = OFFRES[c.equipe.plan].alertes;

  return (
    <>
      {erreur && (
        <p role="alert" className="rounded-bouton bg-rouge-pale px-4 py-3 text-sm text-rouge">
          {erreur}
        </p>
      )}
      <div className={`${CARTE} flex flex-wrap items-center justify-between gap-3 px-5 py-[18px]`}>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-[-0.02em]">{c.utilisateur.nom ?? c.utilisateur.email}</h1>
          <p className="mt-1.5 truncate text-[13px] text-doux">{c.utilisateur.email}</p>
        </div>
        <form action={seDeconnecter}>
          <button type="submit" className={BOUTON_SECONDAIRE}>
            Se déconnecter
          </button>
        </form>
      </div>

      <form action={enregistrerEmails} className={`${CARTE} flex flex-col gap-4 p-5`}>
        <div>
          <h2 className="text-base font-bold">Email du matin</h2>
          <p className="mt-1 text-[13px] text-doux">Chaque matin vers 7 h, les 3 opportunités du jour que tu n&apos;as pas encore reçues.</p>
        </div>
        <label className="flex items-center gap-2.5">
          <input type="checkbox" name="email_matin" value="oui" defaultChecked={c.utilisateur.emailMatin} className="h-4 w-4 accent-vert" />
          Recevoir l&apos;email du matin
        </label>
        <fieldset disabled={!alertes} className="flex flex-col gap-2">
          <legend className="mb-1 text-[13px] font-semibold">
            Alertes par secteur {!alertes && <span className="font-normal text-doux">(offre Pro)</span>}
          </legend>
          <p className="text-[13px] text-doux">Les opportunités de ces secteurs passent en tête de ton email, même si elles ne sont pas dans le Top 3.</p>
          <div className="flex flex-wrap gap-2">
            {secteurs.map((s) => (
              <label key={s} className="flex items-center gap-1.5 rounded-full border border-bordure px-3 py-1.5 text-[13px] has-checked:border-vert has-checked:bg-vert-clair">
                <input type="checkbox" name="secteurs" value={s} defaultChecked={c.utilisateur.secteurs.includes(s)} className="h-3.5 w-3.5 accent-vert" />
                {libelleSecteur(s)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex items-center gap-3 border-t border-trait pt-4">
          <button type="submit" className={BOUTON_PRINCIPAL}>
            Enregistrer
          </button>
          {enregistre && (
            <span role="status" className="text-[13px] text-vert-texte">
              Enregistré.
            </span>
          )}
        </div>
      </form>

      <form action={supprimer} className={`${CARTE} flex flex-col gap-3 p-5`}>
        <h2 className="text-base font-bold">Supprimer mon compte</h2>
        <p className="text-[13px] leading-relaxed text-doux">
          Ton profil et tes réglages sont effacés. Tes équipes passent au membre le plus ancien ; une équipe où tu es seul disparaît avec son suivi. Les enquêtes lancées restent à leur équipe, sans ton nom.
        </p>
        <label className="flex max-w-72 flex-col gap-1.5 text-[13px] text-doux">
          Écris SUPPRIMER pour confirmer
          <input name="confirmation" autoComplete="off" required className={`${CHAMP} py-2 text-sm`} />
        </label>
        <button type="submit" className="self-start rounded-bouton border border-rouge px-4 py-2.5 text-sm font-semibold text-rouge transition-colors duration-150 ease-radar hover:bg-rouge-pale">
          Supprimer définitivement
        </button>
      </form>
    </>
  );
}
