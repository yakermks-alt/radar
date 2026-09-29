import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { baseServeur, topOpportunites, type Opportunite } from "@/lib/serveur/base";
import { BarreHaut } from "./_ui/BarreHaut";
import { CARTE, CHAMP } from "./_ui/styles";
import { libelleSecteur, versSujet } from "./_ui/sujet";

const CRITERES: Record<string, string> = {
  volume: "Fréquence",
  diversite: "Plusieurs applis",
  paiement: "Argent en jeu",
  gravite: "Gravité",
  concentration: "Niche précise",
  marche: "Taille du marché",
  faisabilite: "Faisable seul",
};

type Filtres = { q: string; secteur: string };

export default async function Accueil({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const filtres: Filtres = { q: typeof sp.q === "string" ? sp.q.slice(0, 80) : "", secteur: typeof sp.secteur === "string" ? sp.secteur.slice(0, 40) : "" };
  return (
    <>
      <Suspense fallback={<div className="hidden w-[264px] shrink-0 border-r border-bordure bg-surface lg:block" />}>
        <ColonneFiltres filtres={filtres} />
      </Suspense>
      <main className="flex min-w-0 flex-1 flex-col">
        <BarreHaut chemin={[{ libelle: "Opportunités" }]} />
        <div className="flex flex-col gap-4 px-4 py-5 md:px-7">
          <Suspense fallback={<p className="text-doux">Chargement…</p>}>
            <Tableau filtres={filtres} />
          </Suspense>
        </div>
      </main>
    </>
  );
}

async function donnees() {
  await connection();
  const db = baseServeur();
  const [opportunites, apps, groupes] = await Promise.all([
    topOpportunites(20),
    db.from("apps").select("id", { count: "exact", head: true }).eq("active", true),
    db.from("groupes").select("id", { count: "exact", head: true }),
  ]);
  return { opportunites, nbApps: apps.count ?? 0, nbGroupes: groupes.count ?? 0 };
}

const plat = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const filtrer = (liste: Opportunite[], f: Filtres) => {
  const q = plat(f.q);
  return liste.filter((o) => (!f.secteur || o.secteur === f.secteur) && (!q || plat(`${o.nom} ${o.resume ?? ""}`).includes(q)));
};

async function ColonneFiltres({ filtres }: { filtres: Filtres }) {
  const { opportunites, nbApps } = await donnees();
  const secteurs = [...new Set(opportunites.map((o) => o.secteur).filter((s): s is string => Boolean(s)))].sort();
  return (
    <aside aria-label="Filtres" className="sans-impression hidden w-[264px] shrink-0 flex-col gap-4 border-r border-bordure bg-surface px-4 py-5 lg:sticky lg:top-0 lg:flex lg:h-screen">
      <div className="text-base font-bold">Opportunités</div>
      <form className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[13px] text-doux">
          Rechercher
          <input type="search" name="q" defaultValue={filtres.q} placeholder="Métier, besoin…" className={`${CHAMP} py-2 text-sm`} />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-[13px] text-doux">Secteur</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="secteur" value="" defaultChecked={!filtres.secteur} className="h-4 w-4 accent-vert" />
            Tous
          </label>
          {secteurs.map((s) => (
            <label key={s} className="flex items-center gap-2">
              <input type="radio" name="secteur" value={s} defaultChecked={filtres.secteur === s} className="h-4 w-4 accent-vert" />
              {libelleSecteur(s)}
            </label>
          ))}
        </fieldset>
        <button type="submit" className="self-start rounded-bouton border border-bordure bg-surface px-3.5 py-2 text-[13px] font-semibold transition-colors duration-150 ease-radar hover:bg-surface-2">
          Filtrer
        </button>
      </form>
      <p className="mt-auto rounded-bouton bg-fond p-3 text-xs leading-relaxed text-doux">Classement recalculé chaque nuit à partir des avis négatifs de {nbApps} applis professionnelles.</p>
    </aside>
  );
}

async function Tableau({ filtres }: { filtres: Filtres }) {
  const { opportunites, nbApps, nbGroupes } = await donnees();
  const lignes = filtrer(opportunites, filtres);
  return (
    <>
      <div className={`${CARTE} px-5 py-[18px]`}>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Top 20 des opportunités</h1>
        <p className="mt-1.5 text-[13px] text-doux">
          Mis à jour chaque nuit · {nbApps} applis suivies · {nbGroupes} besoins regroupés à partir des plaintes de leurs utilisateurs
        </p>
      </div>
      {lignes.length === 0 ? (
        <div className={`${CARTE} p-6 text-doux`}>
          {opportunites.length === 0 ? "Aucun classement calculé pour l'instant : il sera prêt après la prochaine collecte de nuit." : "Aucune opportunité ne correspond à ces filtres."}
          {opportunites.length > 0 && (
            <Link href="/" className="ml-2 font-semibold no-underline">
              Tout afficher
            </Link>
          )}
        </div>
      ) : (
        <section className={`${CARTE} overflow-x-auto`}>
          <table className="chiffres w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="bg-surface-2 text-left text-[12.5px] text-doux">
                <th className="w-10 px-4 py-2.5 font-semibold">#</th>
                <th className="px-3 py-2.5 font-semibold">Besoin non couvert</th>
                <th className="w-40 px-3 py-2.5 font-semibold">Score</th>
                <th className="px-3 py-2.5 text-right font-semibold">Entreprises</th>
                <th className="px-3 py-2.5 text-right font-semibold">Avis</th>
                <th className="px-4 py-2.5">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            {lignes.map((o) => (
              <Ligne key={o.id} o={o} rang={opportunites.indexOf(o) + 1} />
            ))}
          </table>
        </section>
      )}
    </>
  );
}

function Ligne({ o, rang }: { o: Opportunite; rang: number }) {
  return (
    <tbody className="border-t border-trait">
      <tr className="align-top transition-colors duration-150 ease-radar hover:bg-surface-2">
        <td className="px-4 py-3 font-semibold text-doux">{rang}</td>
        <td className="px-3 py-3">
          <details className="group">
            <summary className="cursor-pointer list-none font-semibold [&::-webkit-details-marker]:hidden">
              {o.nom}
              <span className="ml-1.5 inline-block text-doux transition-transform duration-150 ease-radar group-open:rotate-90" aria-hidden>
                ›
              </span>
            </summary>
            <div className="mt-2 flex max-w-2xl flex-col gap-3 text-[13px]">
              {o.resume && <p className="leading-relaxed text-texte-2">{o.resume}</p>}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                {Object.entries(CRITERES).map(([cle, libelle]) => (
                  <div key={cle}>
                    <dt className="text-xs text-doux">{libelle}</dt>
                    <dd className="mt-1 h-1.5 rounded-full bg-trait" aria-label={`${(o.detail[cle] ?? 0).toFixed(1)} sur 10`}>
                      <div className="h-full rounded-full bg-graph-3" style={{ width: `${(o.detail[cle] ?? 0) * 10}%` }} />
                    </dd>
                  </div>
                ))}
              </dl>
              {o.faiblesses && o.faiblesses.bug + o.faiblesses.support + o.faiblesses.prix > 0 && (
                <p className="text-doux">
                  Faiblesses des applis en place : {o.faiblesses.bug} plaintes de bugs, {o.faiblesses.support} de support, {o.faiblesses.prix} de prix.
                </p>
              )}
              <ul className="flex flex-col gap-2">
                {o.citations.map((c, k) => (
                  <li key={k} className="rounded-bouton bg-fond px-3 py-2">
                    « {c.contenu.length > 220 ? `${c.contenu.slice(0, 220)}…` : c.contenu} »
                    <span className="mt-1 block text-xs text-doux">
                      {c.app} · {c.note}/5
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
          <div className="mt-0.5 text-xs text-doux">
            {libelleSecteur(o.secteur)} · {o.nbApps} applis concernées
          </div>
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2.5">
            <div className="h-1.5 flex-1 rounded-full bg-trait">
              <div className="h-full rounded-full bg-vert" style={{ width: `${o.score * 10}%` }} />
            </div>
            <span className="w-8 font-bold">{o.score.toFixed(1).replace(".", ",")}</span>
          </div>
        </td>
        <td className="px-3 py-3 text-right">{o.marche ? o.marche.total.toLocaleString("fr-FR") : "–"}</td>
        <td className="px-3 py-3 text-right">{o.nbAvis}</td>
        <td className="px-4 py-3 text-right">
          <Link
            href={`/enquetes?${new URLSearchParams({ sujet: versSujet(o.nom) })}`}
            className="inline-block rounded-bouton border border-bordure bg-surface px-3 py-1.5 text-[13px] font-semibold text-texte no-underline transition-colors duration-150 ease-radar hover:border-vert hover:bg-vert-clair hover:text-vert-fonce"
          >
            Enquêter
          </Link>
        </td>
      </tr>
    </tbody>
  );
}
