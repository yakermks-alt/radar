import Link from "next/link";
import type { Rapport } from "@/lib/agent/agent";
import type { Affirmation } from "@/lib/agent/citations";
import type { EtapeAffichee, SourceAffichee } from "@/lib/serveur/enquetes";
import { concurrent, entreprisesInsee, fiabilite, memeTaxe, prixConcurrents, type Prix } from "@/lib/rapport/lecture";
import { CARTE, tonEnquete } from "../../_ui/styles";
import { LIBELLES_OUTIL } from "../../enquetes/statuts";
import { estLien, nomSource } from "./sources";

export const ONGLETS = [
  { id: "synthese", libelle: "Synthèse" },
  { id: "concurrents", libelle: "Concurrents" },
  { id: "preuves", libelle: "Preuves" },
  { id: "sources", libelle: "Sources" },
  { id: "activite", libelle: "Activité de l'agent" },
] as const;
export type Onglet = (typeof ONGLETS)[number]["id"];

const RAISONS: Record<string, string> = {
  "source inconnue": "source jamais lue par l'agent",
  "citation introuvable": "citation absente de la source",
  "citation trop courte": "citation trop courte pour prouver",
  "chiffre non prouvé": "chiffre absent de la citation",
  "nom non prouvé": "entreprise absente de la citation",
  "citation hors sujet": "citation qui ne prouve pas l'affirmation",
};

function LienSource({ url }: { url: string }) {
  const nom = nomSource(url);
  return estLien(url) ? (
    <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="text-vert no-underline hover:text-vert-fonce hover:underline">
      {nom}
    </a>
  ) : (
    <span className="text-doux">{nom}</span>
  );
}

function Coche() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="mt-0.5 shrink-0">
      <circle cx="9" cy="9" r="9" fill="var(--color-vert-pale)" />
      <path d="M5 9.5 L8 12 L13 6.5" fill="none" stroke="var(--color-vert)" strokeWidth="2" />
    </svg>
  );
}

function LignePreuve({ a }: { a: Affirmation }) {
  return (
    <li className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-2.5 border-b border-trait py-2.5 last:border-b-0">
      <Coche />
      <div>
        <div className="font-semibold">{a.texte}</div>
        <div className="mt-0.5 text-[12.5px] text-doux">« {a.citation} »</div>
      </div>
      <span className="text-xs">
        <LienSource url={a.source} />
      </span>
    </li>
  );
}

const euros = (p: Prix) => (p.annuel ? `${p.annuel.toLocaleString("fr-FR")} €/an` : `${p.prix.toLocaleString("fr-FR")} €`) + (p.taxe ? ` ${p.taxe}` : "");

// Graphique en colonnes des prix, avec HT ou TTC sous chaque barre (point 3 : ne pas comparer
// des prix de nature différente sans le dire). Tableau équivalent pour les lecteurs d'écran.
function GraphiquePrix({ prix }: { prix: Prix[] }) {
  const melange = !memeTaxe(prix);
  const max = Math.max(...prix.map((p) => p.prix));
  const couleurs = ["var(--color-graph-1)", "var(--color-graph-2)", "var(--color-graph-3)", "var(--color-graph-4)"];
  const largeur = 400;
  const pas = (largeur - 40) / prix.length;
  return (
    <figure className="m-0">
      <svg width="100%" viewBox={`0 0 ${largeur} 250`} aria-hidden>
        <line x1="20" y1="200" x2={largeur - 10} y2="200" stroke="var(--color-trait)" />
        {prix.map((p, i) => {
          const h = Math.max(4, (p.prix / max) * 160);
          const x = 30 + i * pas + pas / 2;
          return (
            <g key={p.nom}>
              <rect x={x - Math.min(29, pas / 3)} y={200 - h} width={Math.min(58, (pas * 2) / 3)} height={h} rx="5" fill={couleurs[Math.min(3, Math.floor((i / prix.length) * 4))]} />
              <text x={x} y={192 - h} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-texte)">
                {euros(p)}
              </text>
              <text x={x} y="220" textAnchor="middle" fontSize="11" fill="var(--color-doux)">
                {p.nom.length > 14 ? `${p.nom.slice(0, 13)}…` : p.nom}
              </text>
              {(melange || p.annuel) && (
                <text x={x} y="236" textAnchor="middle" fontSize="10" fill="var(--color-doux)">
                  {[p.annuel ? `soit ${p.prix} €/mois` : null, melange ? (p.taxe ?? "HT ou TTC ?") : null].filter(Boolean).join(" · ")}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>Prix mensuels des concurrents</caption>
        <tbody>
          {prix.map((p) => (
            <tr key={p.nom}>
              <th>{p.nom}</th>
              <td>{euros(p)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function Synthese({ rapport, statut }: { rapport: Rapport; statut: string }) {
  const ton = tonEnquete({ statut, erreur: null, verdict: rapport.verdict });
  const f = fiabilite(rapport);
  const prix = prixConcurrents(rapport);
  const marche = entreprisesInsee(rapport);
  const toutes = rapport.sections.flatMap((s) => s.affirmations);
  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`rounded-carte px-[18px] py-4 ${ton.carte} ${ton.carteTexte}`}>
          <div className={`text-[13px] ${ton.carteDoux}`}>Verdict de l&apos;agent</div>
          <div className="mt-1.5 text-2xl font-bold">{ton.libelle}</div>
          <div className={`text-xs ${ton.carteDoux}`}>d&apos;après {f.gardees} preuves vérifiées</div>
        </div>
        <div className={`${CARTE} px-[18px] py-4`}>
          <div className="text-[13px] text-doux">Fiabilité</div>
          <div className="mt-1.5 text-2xl font-bold">
            {f.gardees} <span className="text-sm font-normal text-doux">preuves vérifiées</span>
          </div>
          <div className="text-xs text-doux">
            {f.retirees} affirmation{f.retirees > 1 ? "s" : ""} retirée{f.retirees > 1 ? "s" : ""} faute de preuve
          </div>
        </div>
        <div className={`${CARTE} px-[18px] py-4`}>
          <div className="text-[13px] text-doux">Marché adressable</div>
          <div className="mt-1.5 text-2xl font-bold">{marche ? marche.toLocaleString("fr-FR") : "Non mesuré"}</div>
          <div className="text-xs text-doux">{marche ? "entreprises du métier (Insee)" : "aucun comptage Insee dans ce rapport"}</div>
        </div>
        <div className={`${CARTE} px-[18px] py-4`}>
          <div className="text-[13px] text-doux">Prix des concurrents</div>
          <div className="mt-1.5 text-2xl font-bold">{prix.length === 0 ? "Non trouvés" : prix.length === 1 ? `${prix[0].prix} €` : `${prix[0].prix} – ${prix.at(-1)!.prix} €`}</div>
          <div className="text-xs text-doux">{prix.length ? (memeTaxe(prix) ? `par mois${prix[0].taxe ? `, ${prix[0].taxe}` : ""}` : "par mois, HT et TTC mélangés") : "aucun prix cité mot pour mot"}</div>
        </div>
      </div>

      <div className="grid gap-3.5 xl:grid-cols-12">
        {prix.length >= 2 && (
          <section className={`${CARTE} p-[18px] xl:col-span-5`}>
            <h2 className="mb-2 text-base font-bold">Prix mensuels</h2>
            <GraphiquePrix prix={prix} />
            {!memeTaxe(prix) && <p className="mt-1 text-xs text-ambre-texte">Attention : ces prix mélangent HT et TTC (environ 20 % d&apos;écart).</p>}
            {memeTaxe(prix) && !prix[0].taxe && <p className="mt-1 text-xs text-doux">Prix mensuels, HT ou TTC non précisé par les sources.</p>}
            {prix.some((p) => p.annuel) && <p className="mt-1 text-xs text-doux">Les prix annuels sont ramenés au mois (divisés par 12).</p>}
          </section>
        )}
        <section className={`${CARTE} p-[18px] ${prix.length >= 2 ? "xl:col-span-7" : "xl:col-span-12"}`}>
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-bold">Preuves retenues</h2>
            <Link href="?onglet=preuves" className="text-[13px] font-semibold no-underline">
              Tout voir ({toutes.length})
            </Link>
          </div>
          {toutes.length === 0 ? (
            <p className="mt-2 text-sm text-doux">Aucune affirmation n&apos;a pu être prouvée.</p>
          ) : (
            <ul className="mt-1">
              {toutes.slice(0, 4).map((a, i) => (
                <LignePreuve key={i} a={a} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export function Concurrents({ rapport }: { rapport: Rapport }) {
  const lignes = rapport.sections.find((s) => s.titre === "Concurrents et prix")?.affirmations ?? [];
  if (!lignes.length) return <p className={`${CARTE} p-6 text-doux`}>Aucun concurrent n&apos;a pu être documenté avec une preuve exacte.</p>;
  return (
    <section className={`${CARTE} overflow-x-auto`}>
      <table className="chiffres w-full border-collapse">
        <thead>
          <tr className="bg-surface-2 text-left text-[12.5px] text-doux">
            <th className="px-4 py-2.5 font-semibold">Concurrent</th>
            <th className="px-4 py-2.5 font-semibold">Ce que dit la source</th>
            <th className="px-4 py-2.5 font-semibold">Source</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((a, i) => (
            <tr key={i} className="border-t border-trait align-top transition-colors duration-150 ease-radar hover:bg-surface-2">
              <td className="px-4 py-3 font-semibold">{concurrent(a) ?? "–"}</td>
              <td className="px-4 py-3">
                {a.texte}
                <div className="mt-1 text-[12.5px] text-doux">« {a.citation} »</div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-[13px]">
                <LienSource url={a.source} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function Preuves({ rapport }: { rapport: Rapport }) {
  return (
    <div className="flex flex-col gap-3.5">
      {rapport.sections.map((s) => (
        <section key={s.titre} className={`${CARTE} p-[18px]`}>
          <h2 className="text-base font-bold">
            {s.titre} <span className="font-normal text-doux">· {s.affirmations.length}</span>
          </h2>
          {s.affirmations.length === 0 ? (
            <p className="mt-2 text-sm text-doux">Aucune preuve trouvée.</p>
          ) : (
            <ul className="mt-1">
              {s.affirmations.map((a, i) => (
                <LignePreuve key={i} a={a} />
              ))}
            </ul>
          )}
        </section>
      ))}
      {rapport.rejetees.length > 0 && (
        <section className={`${CARTE} p-[18px]`}>
          <h2 className="text-base font-bold">
            Retirées faute de preuve <span className="font-normal text-doux">· {rapport.rejetees.length}</span>
          </h2>
          <p className="mt-1 text-[13px] text-doux">L&apos;agent les avait écrites, les contrôles les ont écartées.</p>
          <ul className="mt-2 flex flex-col gap-2">
            {rapport.rejetees.map((r, i) => (
              <li key={i} className="rounded-bouton bg-surface-2 px-3 py-2 text-[13px]">
                <span className="text-texte-2">{r.texte}</span>
                <span className="ml-2 text-xs text-ambre-texte">{RAISONS[r.raison] ?? r.raison}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function Sources({ sources, rapport }: { sources: SourceAffichee[]; rapport: Rapport }) {
  const citees = new Set(rapport.sections.flatMap((s) => s.affirmations.map((a) => a.source)));
  const triees = [...sources].sort((a, b) => Number(citees.has(b.url)) - Number(citees.has(a.url)));
  return (
    <section className={`${CARTE} overflow-x-auto`}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-surface-2 text-left text-[12.5px] text-doux">
            <th className="px-4 py-2.5 font-semibold">Source</th>
            <th className="px-4 py-2.5 font-semibold">Titre</th>
            <th className="px-4 py-2.5 font-semibold">Dans le rapport</th>
          </tr>
        </thead>
        <tbody>
          {triees.map((s) => (
            <tr key={s.url} className="border-t border-trait transition-colors duration-150 ease-radar hover:bg-surface-2">
              <td className="whitespace-nowrap px-4 py-2.5 text-[13px]">
                <LienSource url={s.url} />
              </td>
              <td className="px-4 py-2.5 text-[13px] text-texte-2">
                {s.titre ?? "–"}
                {s.suspecte && <span className="ml-2 rounded-full bg-ambre-pale px-2 py-0.5 text-xs text-ambre-texte">instructions cachées repérées</span>}
              </td>
              <td className="px-4 py-2.5 text-[13px]">{citees.has(s.url) ? <span className="font-semibold text-vert-texte">Citée</span> : <span className="text-doux">Lue</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function Activite({ etapes }: { etapes: EtapeAffichee[] }) {
  return (
    <section className={`${CARTE} p-[18px]`}>
      <ol className="flex flex-col">
        {etapes.map((e) => {
          const rate = e.statut === "erreur";
          return (
            <li key={e.numero} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3 border-b border-trait py-3 last:border-b-0">
              <span className={`flex h-8 w-8 items-center justify-center rounded-bouton text-xs font-bold ${rate ? "bg-ambre-pale text-ambre-texte" : "bg-vert-pale text-vert"}`}>{e.numero}</span>
              <div className="min-w-0">
                <div className="font-semibold">{LIBELLES_OUTIL[e.outil] ?? e.outil}</div>
                {e.argument && <div className="mt-0.5 break-words text-[13px] text-doux">{e.argument}</div>}
                {e.pensee && <div className="mt-1.5 text-[13px] italic text-texte-2">{e.pensee}</div>}
              </div>
              <span className={`max-w-56 text-right text-xs font-semibold ${rate ? "text-ambre-texte" : "text-vert"}`}>{e.resultat}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
