import type { EtapeAffichee, SourceAffichee } from "@/lib/serveur/enquetes";
import { CARTE } from "../../_ui/styles";
import { LIBELLES_OUTIL } from "../../enquetes/statuts";
import { nomSource } from "./sources";

// Ce que l'agent a déjà trouvé, lu dans les résultats des étapes (rien d'autre n'est stocké en direct).
function dejaTrouve(etapes: EtapeAffichee[]) {
  const ok = etapes.filter((e) => e.statut === "ok");
  const nombre = (r: string | null, motif: RegExp) => Number(r?.match(motif)?.[1]?.replace(/[\s  ]/g, "") ?? 0);
  return {
    entreprises: Math.max(0, ...ok.filter((e) => e.outil === "entreprises").map((e) => nombre(e.resultat, /^([\d\s  ]+) entreprises/))),
    avis: ok.filter((e) => e.outil === "chercher_avis").reduce((s, e) => s + nombre(e.resultat, /^(\d+)/), 0),
    web: ok.filter((e) => e.outil === "rechercher_web").reduce((s, e) => s + nombre(e.resultat, /^(\d+)/), 0),
    pages: ok.filter((e) => e.outil === "lire_page").length,
  };
}

export function VueDirect({ etapes, sources, budget, active }: { etapes: EtapeAffichee[]; sources: SourceAffichee[]; budget: number; active: boolean }) {
  const t = dejaTrouve(etapes);
  const noms = [...new Set(sources.map((s) => nomSource(s.url)))].slice(0, 14);
  return (
    <div className="grid gap-3.5 xl:grid-cols-12">
      <section className={`${CARTE} p-[18px] xl:col-span-7`}>
        <h2 className="mb-2 text-base font-bold">Ce que fait l&apos;agent</h2>
        <ol className="flex flex-col">
          {etapes.map((e) => {
            const rate = e.statut === "erreur";
            return (
              <li key={e.numero} className="grid animate-entree grid-cols-[36px_minmax(0,1fr)_auto] items-start gap-3 border-b border-trait py-3">
                <span className={`flex h-8 w-8 items-center justify-center rounded-bouton text-xs font-bold ${rate ? "bg-ambre-pale text-ambre-texte" : "bg-vert-pale text-vert"}`}>{e.numero}</span>
                <div className="min-w-0">
                  <div className="font-semibold">{LIBELLES_OUTIL[e.outil] ?? e.outil}</div>
                  {e.argument && <div className="mt-0.5 truncate text-[13px] text-doux">{e.argument}</div>}
                  {e.pensee && <div className="mt-1.5 text-[13px] italic text-texte-2">{e.pensee}</div>}
                </div>
                <span className={`max-w-48 text-right text-xs font-semibold ${rate ? "text-ambre-texte" : "text-vert"}`}>{e.resultat}</span>
              </li>
            );
          })}
          {active && (
            <li className="grid animate-entree grid-cols-[36px_minmax(0,1fr)] items-center gap-3 py-3.5">
              <span className="h-8 w-8 animate-pouls rounded-bouton bg-vert-clair" aria-hidden />
              <div className="flex flex-col gap-2">
                <div className="font-semibold text-texte-2">{etapes.length ? "L'agent choisit sa prochaine action…" : "Démarrage de l'agent…"}</div>
                <div className="h-2.5 w-3/5 animate-pouls rounded-full bg-trait" aria-hidden />
              </div>
            </li>
          )}
        </ol>
      </section>

      <aside className="flex flex-col gap-3.5 xl:col-span-5">
        <section className={`${CARTE} p-[18px]`}>
          <h2 className="mb-3 text-base font-bold">Déjà trouvé</h2>
          <dl className="chiffres grid grid-cols-2 gap-3">
            {[
              ["Entreprises du métier", t.entreprises ? t.entreprises.toLocaleString("fr-FR") : "–"],
              ["Avis de clients", t.avis],
              ["Résultats web", t.web],
              ["Pages lues", t.pages],
            ].map(([libelle, valeur]) => (
              <div key={libelle as string} className="rounded-bouton bg-surface-2 p-3">
                <dt className="text-xs text-doux">{libelle}</dt>
                <dd className="text-[22px] font-bold">{valeur}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className={`${CARTE} flex-1 p-[18px]`}>
          <h2 className="mb-3 text-base font-bold">Sources consultées</h2>
          {noms.length === 0 ? (
            <p className="text-[13px] text-doux">Aucune pour l&apos;instant.</p>
          ) : (
            <ul className="flex flex-wrap gap-2 text-[13px]">
              {noms.map((n) => (
                <li key={n} className="rounded-full bg-fond px-2.5 py-1.5">
                  {n}
                </li>
              ))}
            </ul>
          )}
          {active && <p className="mt-3.5 text-[13px] leading-relaxed text-doux">Le rapport s&apos;affichera ici dès que l&apos;agent aura fini. Tu peux quitter la page : l&apos;enquête continue.</p>}
          <p className="mt-2 text-xs text-doux">
            Étape {Math.min(etapes.length + (active ? 1 : 0), budget)} sur {budget} au plus
          </p>
        </section>
      </aside>
    </div>
  );
}
