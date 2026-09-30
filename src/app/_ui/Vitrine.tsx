import Link from "next/link";
import type { ReactNode } from "react";
import { OFFRES } from "@/lib/offres";
import { baseServeur, topOpportunites } from "@/lib/serveur/base";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, CARTE } from "./styles";
import { Solidite } from "./Solidite";
import { libelleSecteur } from "./sujet";

// Page d'accueil publique (direction B « Le classement », choisie le 30/09) : le vrai classement du
// jour sert de vitrine. Les 3 premières lignes sont complètes ; les 2 suivantes n'envoient au
// navigateur que leur rang et leur score, jamais le besoin lui-même.

const LIGNES_VISIBLES = 3;
const LIGNES_MASQUEES = 2;

export function Logo({ taille = 24 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 26 26" fill="none" aria-hidden>
      <circle cx="13" cy="13" r="11" stroke="var(--color-vert)" strokeWidth="2" />
      <circle cx="13" cy="13" r="4" fill="var(--color-vert)" />
    </svg>
  );
}

export function EnTetePublic({ action }: { action: ReactNode }) {
  return (
    <header className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-7">
      <Link href="/" className="flex items-center gap-2.5 text-[17px] font-extrabold tracking-[-0.01em] text-texte no-underline">
        <Logo />
        Radar
      </Link>
      <nav aria-label="Navigation" className="flex items-center gap-4 text-[13.5px]">
        <Link href="/tarifs" className="text-texte-2 no-underline hover:text-texte">
          Tarifs
        </Link>
        {action}
      </nav>
    </header>
  );
}

export function PiedPublic() {
  const responsable = process.env.RADAR_RESPONSABLE;
  return (
    <footer className="mx-auto mt-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-3 border-t border-bordure px-4 py-5 text-[13px] text-doux md:px-7">
      <span>Radar{responsable ? ` · un projet de ${responsable}` : ""} · paiements en mode test</span>
      <span className="flex gap-4">
        <Link href="/tarifs" className="text-doux no-underline hover:text-texte">
          Tarifs
        </Link>
        <Link href="/confidentialite" className="text-doux no-underline hover:text-texte">
          Confidentialité
        </Link>
        <a href="https://github.com/yakermks-alt/radar" className="text-doux no-underline hover:text-texte">
          Code source
        </a>
      </span>
    </footer>
  );
}

const virgule = (n: number) => n.toFixed(1).replace(".", ",");

export async function Vitrine() {
  const db = baseServeur();
  const [top, apps, avis, derniere] = await Promise.all([
    topOpportunites(LIGNES_VISIBLES + LIGNES_MASQUEES),
    db.from("apps").select("id", { count: "exact", head: true }).eq("active", true),
    db.from("avis").select("id", { count: "exact", head: true }),
    db.from("journal").select("termine_le").eq("tache", "regroupement").eq("statut", "ok").order("termine_le", { ascending: false }).limit(1).maybeSingle<{ termine_le: string | null }>(),
  ]);
  const visibles = top.slice(0, LIGNES_VISIBLES);
  const masquees = top.slice(LIGNES_VISIBLES).map((o) => ({ rang: o.rang, score: o.score })); // seulement ce qui s'affiche
  const maj = derniere.data?.termine_le
    ? new Date(derniere.data.termine_le).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" })
    : null;
  const nb = (n: number | null) => (n ?? 0).toLocaleString("fr-FR");

  return (
    <div className="flex min-h-screen w-full flex-col">
      <EnTetePublic
        action={
          <Link href="/connexion" className={`${BOUTON_PRINCIPAL} no-underline`}>
            Voir tout le classement
          </Link>
        }
      />
      <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 pt-8 pb-12 md:px-7 md:pt-12">
        <div className="flex max-w-[760px] flex-col gap-3.5">
          <p className="text-[13px] text-doux">
            {maj ? `Mis à jour le ${maj}` : "Mis à jour chaque nuit"} · {nb(apps.count)} applis et logiciels suivis · {nb(avis.count)} avis
          </p>
          <h1 className="text-[clamp(28px,4.2vw,42px)] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance">
            Les besoins que les logiciels pro ne couvrent pas, classés chaque nuit.
          </h1>
          <p className="max-w-[56ch] text-base leading-relaxed text-texte-2">
            Tiré des avis 1 et 2 étoiles de leurs propres clients (App Store et Trustpilot), avec la taille réelle du marché d&apos;après l&apos;Insee. Pour chaque besoin, un agent enquête sur les concurrents et leurs prix, et cite ses sources mot pour mot.
          </p>
        </div>

        <section aria-label="Classement du jour" className={`${CARTE} overflow-hidden`}>
          <table className="chiffres w-full border-collapse">
            <thead>
              <tr className="bg-surface-2 text-left text-[12.5px] text-doux">
                <th className="w-8 py-2.5 pr-1 pl-4 font-semibold md:w-12 md:px-4">#</th>
                <th className="px-3 py-2.5 font-semibold">Besoin non couvert</th>
                <th className="w-14 px-3 py-2.5 font-semibold md:w-44">Score</th>
                <th className="hidden px-3 py-2.5 text-right font-semibold md:table-cell">Entreprises</th>
                <th className="hidden px-4 py-2.5 text-right font-semibold md:table-cell">Avis</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((o) => (
                <tr key={o.id} className="border-t border-trait align-top">
                  <td className="py-3.5 pr-1 pl-4 text-doux md:px-4">{o.rang}</td>
                  <td className="px-3 py-3.5">
                    <div className="font-semibold">{o.nom}</div>
                    <div className="mt-0.5 text-xs text-doux">
                      <Solidite niveau={o.solidite} nbAvis={o.nbAvis} nbApps={o.nbApps} /> {libelleSecteur(o.secteur)} · {o.nbApps} applis concernées
                      <span className="md:hidden">{o.marche ? ` · ${o.marche.total.toLocaleString("fr-FR")} entreprises` : ""}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <Score score={o.score} />
                  </td>
                  <td className="hidden px-3 py-3.5 text-right md:table-cell">{o.marche ? o.marche.total.toLocaleString("fr-FR") : "–"}</td>
                  <td className="hidden px-4 py-3.5 text-right md:table-cell">{o.nbAvis}</td>
                </tr>
              ))}
              {masquees.map((o) => (
                <tr key={o.rang} className="border-t border-trait align-top" aria-label={`Opportunité n° ${o.rang}, réservée aux comptes`}>
                  <td className="py-3.5 pr-1 pl-4 text-doux md:px-4">{o.rang}</td>
                  <td className="px-3 py-3.5" aria-hidden>
                    <div className="h-3.5 w-[min(420px,85%)] rounded-full bg-trait blur-[2px]" />
                    <div className="mt-2 h-2.5 w-[min(220px,55%)] rounded-full bg-trait blur-[2px]" />
                  </td>
                  <td className="px-3 py-3.5">
                    <Score score={o.score} />
                  </td>
                  <td className="hidden px-3 py-3.5 md:table-cell" aria-hidden>
                    <div className="ml-auto h-3 w-16 rounded-full bg-trait blur-[2px]" />
                  </td>
                  <td className="hidden px-4 py-3.5 md:table-cell" aria-hidden>
                    <div className="ml-auto h-3 w-8 rounded-full bg-trait blur-[2px]" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-trait bg-surface-2 px-4 py-3.5">
            <p className="text-[13.5px]">
              <span className="font-semibold">+ {OFFRES.pro.opportunites - LIGNES_VISIBLES} autres opportunités</span>{" "}
              <span className="text-doux">avec leurs avis, leurs concurrents et une enquête en un clic</span>
            </p>
            <Link href="/connexion" className={`${BOUTON_PRINCIPAL} no-underline`}>
              Se connecter pour voir
            </Link>
          </div>
        </section>

        <section aria-label="Comment ça marche" className="grid gap-3.5 md:grid-cols-3">
          {[
            ["Les plaintes", `${nb(avis.count)} avis d'applis et de logiciels professionnels (App Store, Trustpilot), relus et regroupés par besoin.`],
            ["L'enquête", "Pour un besoin, l'agent cherche les concurrents, lit leurs pages de prix et compte les entreprises du métier."],
            ["La preuve", "Chaque affirmation du rapport cite sa source mot pour mot. Sans citation exacte, elle est retirée."],
          ].map(([titre, texte]) => (
            <div key={titre} className={`${CARTE} p-4`}>
              <div className="font-semibold">{titre}</div>
              <p className="mt-1 text-[13.5px] leading-snug text-doux">{texte}</p>
            </div>
          ))}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/connexion" className={`${BOUTON_PRINCIPAL} px-5 py-3 text-[15px] no-underline`}>
            Commencer gratuitement
          </Link>
          <Link href="/tarifs" className={`${BOUTON_SECONDAIRE} px-5 py-3 text-[15px] no-underline`}>
            Voir les tarifs
          </Link>
          <span className="text-[13px] text-doux">
            Connexion avec Google ou GitHub · {OFFRES.gratuit.opportunites} opportunités par jour et {OFFRES.gratuit.enquetesSemaine} enquête par semaine, gratuitement
          </span>
        </div>
      </main>
      <PiedPublic />
    </div>
  );
}

function Score({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="hidden h-1.5 flex-1 rounded-full bg-trait md:block">
        <div className="h-full rounded-full bg-vert" style={{ width: `${score * 10}%` }} />
      </div>
      <span className="w-8 font-bold">{virgule(score)}</span>
    </div>
  );
}
