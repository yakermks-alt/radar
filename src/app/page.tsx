import { connection } from "next/server";
import { Suspense } from "react";
import { topOpportunites, type Opportunite } from "@/lib/serveur/base";

const CRITERES: Record<string, string> = {
  volume: "Fréquence",
  diversite: "Plusieurs applis",
  paiement: "Argent en jeu",
  gravite: "Gravité",
  concentration: "Niche précise",
  faisabilite: "Faisable seul",
};

export default function Accueil() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <header className="mb-10">
        <p className="text-sm font-medium uppercase tracking-wider text-neutral-500">Radar</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Top 20 des problèmes</h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Besoins non couverts, tirés des avis de professionnels français sur leurs logiciels, regroupés par sens et
          classés par potentiel.
        </p>
      </header>
      <Suspense fallback={<p className="text-neutral-500">Chargement…</p>}>
        <Liste />
      </Suspense>
    </main>
  );
}

async function Liste() {
  await connection();
  const opportunites = await topOpportunites(20);
  if (opportunites.length === 0) {
    return <p className="text-neutral-500">Aucun groupe calculé pour l&apos;instant.</p>;
  }
  return (
    <ol className="flex flex-col gap-6">
      {opportunites.map((o, i) => (
        <Carte key={o.id} o={o} rang={i + 1} />
      ))}
    </ol>
  );
}

function Carte({ o, rang }: { o: Opportunite; rang: number }) {
  return (
    <li className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex items-start gap-4">
        <span className="mt-1 w-6 shrink-0 text-right text-sm tabular-nums text-neutral-400">{rang}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold leading-snug">{o.nom}</h2>
            <span className="shrink-0 rounded-md bg-neutral-900 px-2 py-1 text-sm font-semibold tabular-nums text-white dark:bg-white dark:text-neutral-900">
              {o.score.toFixed(1)}
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {o.nbAvis} avis · {o.nbApps} applis · {o.secteur}
          </p>
          {o.resume && <p className="mt-3 text-neutral-700 dark:text-neutral-300">{o.resume}</p>}

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            {Object.entries(CRITERES).map(([cle, libelle]) => (
              <div key={cle}>
                <dt className="text-xs text-neutral-500">{libelle}</dt>
                <dd className="mt-1 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800" aria-label={`${o.detail[cle] ?? 0} sur 10`}>
                  <div className="h-full rounded-full bg-neutral-700 dark:bg-neutral-300" style={{ width: `${(o.detail[cle] ?? 0) * 10}%` }} />
                </dd>
              </div>
            ))}
          </dl>

          {o.faiblesses && o.faiblesses.bug + o.faiblesses.support + o.faiblesses.prix > 0 && (
            <div className="mt-4 rounded-lg bg-neutral-100 p-3 text-sm dark:bg-neutral-900">
              <p className="font-medium">Faiblesses des applis en place</p>
              <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                {o.faiblesses.bug} plaintes de bugs · {o.faiblesses.support} de support · {o.faiblesses.prix} de prix
              </p>
              {o.faiblesses.exemples.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-neutral-600 dark:text-neutral-400">
                  {o.faiblesses.exemples.map((e) => (
                    <li key={e.categorie}>{e.probleme}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <ul className="mt-4 flex flex-col gap-3">
            {o.citations.map((c, k) => (
              <li key={k} className="border-l-2 border-neutral-300 pl-3 text-sm dark:border-neutral-700">
                <p className="text-neutral-700 dark:text-neutral-300">
                  {c.titre && <span className="font-medium">{c.titre}. </span>}
                  {c.contenu.length > 240 ? `${c.contenu.slice(0, 240)}…` : c.contenu}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {"★".repeat(c.note)}
                  {"☆".repeat(5 - c.note)} · {c.app}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}
