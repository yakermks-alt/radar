import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { enqueteParJeton, type EtapeAffichee } from "@/lib/serveur/enquetes";
import type { Rapport } from "@/lib/agent/agent";
import { LIBELLES_OUTIL, LIBELLES_STATUT, LIBELLES_VERDICT } from "../../enquetes/statuts";
import { Direct } from "./Direct";

export default function PageEnquete({ params }: PageProps<"/enquete/[jeton]">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <Link href="/enquetes" className="text-sm font-medium uppercase tracking-wider text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
        Radar · Enquêtes
      </Link>
      <Suspense fallback={<p className="mt-6 text-neutral-500">Chargement…</p>}>
        <Contenu params={params} />
      </Suspense>
    </main>
  );
}

async function Contenu({ params }: { params: PageProps<"/enquete/[jeton]">["params"] }) {
  await connection();
  const { jeton } = await params;
  const trouvee = await enqueteParJeton(jeton);
  if (!trouvee) notFound();
  const { enquete, etapes } = trouvee;
  const active = enquete.statut === "en_attente" || enquete.statut === "en_cours";
  const interrompue = active && enquete.erreur !== null;

  return (
    <>
      {active && !interrompue && <Direct jeton={enquete.jeton} />}
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{enquete.sujet}</h1>
      <p className="mt-2 text-sm text-neutral-500">
        {interrompue ? "Interrompue" : LIBELLES_STATUT[enquete.statut]} · étape {Math.min(enquete.etapes_faites, enquete.budget)} sur {enquete.budget} au plus
      </p>
      {interrompue && (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          L&apos;enquête s&apos;est arrêtée : {enquete.erreur}. Elle pourra reprendre là où elle en était.
        </p>
      )}

      {enquete.rapport && <BlocRapport rapport={enquete.rapport} />}

      <h2 className="mb-4 mt-10 text-lg font-semibold">{enquete.rapport ? "Comment l'agent a enquêté" : "L'agent enquête"}</h2>
      <ol className="flex flex-col gap-4 border-l border-neutral-200 pl-5 dark:border-neutral-800">
        {etapes.map((e) => (
          <Etape key={e.numero} e={e} />
        ))}
        {active && !interrompue && (
          <li className="relative text-sm text-neutral-500">
            <span className="absolute -left-[25px] top-1.5 h-2 w-2 animate-pulse rounded-full bg-neutral-900 dark:bg-white" aria-hidden />
            {etapes.length ? "L'agent choisit sa prochaine action…" : "Démarrage de l'agent…"}
          </li>
        )}
      </ol>
    </>
  );
}

function Etape({ e }: { e: EtapeAffichee }) {
  const rate = e.statut === "erreur";
  return (
    <li className="relative">
      <span
        className={`absolute -left-[25px] top-1.5 h-2 w-2 rounded-full ${rate ? "bg-amber-500" : "bg-neutral-400 dark:bg-neutral-600"}`}
        aria-hidden
      />
      <p className="text-sm">
        <span className="font-medium">{LIBELLES_OUTIL[e.outil] ?? e.outil}</span>
        {e.argument && <span className="text-neutral-600 dark:text-neutral-400"> · {e.argument}</span>}
      </p>
      {e.resultat && <p className={`mt-0.5 text-sm ${rate ? "text-amber-700 dark:text-amber-400" : "text-neutral-500"}`}>{e.resultat}</p>}
      {e.pensee && <p className="mt-1 text-sm italic text-neutral-500">{e.pensee}</p>}
    </li>
  );
}

const lien = (url: string) => /^https?:\/\//.test(url);

function BlocRapport({ rapport }: { rapport: Rapport }) {
  return (
    <section className="mt-8">
      <p className="inline-block rounded-md bg-neutral-900 px-2 py-1 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900">
        Verdict : {LIBELLES_VERDICT[rapport.verdict] ?? rapport.verdict}
      </p>
      {rapport.sections.map((s) => (
        <div key={s.titre} className="mt-8">
          <h2 className="text-lg font-semibold">{s.titre}</h2>
          {s.affirmations.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">Aucune preuve trouvée.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-4">
              {s.affirmations.map((a, i) => (
                <li key={i}>
                  <p>{a.texte}</p>
                  <blockquote className="mt-1 border-l-2 border-neutral-300 pl-3 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
                    « {a.citation} »
                    <span className="mt-0.5 block text-xs text-neutral-500">
                      {lien(a.source) ? (
                        <a href={a.source} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100">
                          {new URL(a.source).hostname.replace(/^www\./, "")}
                        </a>
                      ) : (
                        "Avis App Store"
                      )}
                    </span>
                  </blockquote>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {rapport.rejetees.length > 0 && (
        <details className="mt-8 rounded-lg bg-neutral-100 p-3 text-sm dark:bg-neutral-900">
          <summary className="cursor-pointer font-medium">
            {rapport.rejetees.length} affirmation{rapport.rejetees.length > 1 ? "s" : ""} retirée{rapport.rejetees.length > 1 ? "s" : ""} faute de preuve
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-neutral-600 dark:text-neutral-400">
            {rapport.rejetees.map((r, i) => (
              <li key={i}>
                <span className="text-neutral-500">[{r.raison}]</span> {r.texte}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
