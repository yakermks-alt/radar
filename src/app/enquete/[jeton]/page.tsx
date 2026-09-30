import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { enqueteParJeton } from "@/lib/serveur/enquetes";
import { contexte } from "@/lib/serveur/session";
import { BarreHaut } from "../../_ui/BarreHaut";
import { ListeEnquetes } from "../../_ui/ListeEnquetes";
import { erreurLisible } from "../../_ui/erreurs";
import { CARTE } from "../../_ui/styles";
import { Direct } from "./Direct";
import { Imprimer } from "./Imprimer";
import { Activite, Concurrents, ONGLETS, Preuves, Sources, Synthese, type Onglet } from "./Onglets";
import { Reprendre, Suivre } from "./Reprendre";
import { VueDirect } from "./VueDirect";

type Props = PageProps<"/enquete/[jeton]">;

export default function PageEnquete({ params, searchParams }: Props) {
  return (
    <>
      <Suspense fallback={null}>
        <Colonne params={params} />
      </Suspense>
      <main className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<p className="p-7 text-doux">Chargement…</p>}>
          <Contenu params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Colonne({ params }: { params: Props["params"] }) {
  const { jeton } = await params;
  return <ListeEnquetes jetonActif={jeton} />;
}

const court = (s: string) => (s.length > 48 ? `${s.slice(0, 47)}…` : s);

async function Contenu({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  await connection();
  const { jeton } = await params;
  const { onglet: brut } = await searchParams;
  const [trouvee, c] = await Promise.all([enqueteParJeton(jeton), contexte()]);
  if (!trouvee) notFound();
  const connecte = c !== null;
  const { enquete, etapes, sources } = trouvee;
  const active = enquete.statut === "en_attente" || enquete.statut === "en_cours";
  const interrompue = active && enquete.erreur !== null;
  const onglet: Onglet = ONGLETS.some((o) => o.id === brut) ? (brut as Onglet) : "synthese";
  const rapport = enquete.rapport;
  const duree = enquete.mesures?.duree_s ? `enquête de ${Math.round(enquete.mesures.duree_s)} s` : `${etapes.length} étapes`;
  const date = new Date(enquete.cree_le).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" });
  const lues = sources.filter((s) => !s.url.startsWith("radar://")).length;
  const preuves = rapport ? rapport.sections.reduce((n, s) => n + s.affirmations.length, 0) : 0;
  const concurrents = rapport?.sections.find((s) => s.titre === "Concurrents et prix")?.affirmations.length ?? 0;
  const comptes: Partial<Record<Onglet, number>> = { concurrents, preuves, sources: sources.length };

  return (
    <>
      {active && !interrompue && <Direct jeton={enquete.jeton} />}
      <BarreHaut chemin={[{ libelle: "Enquêtes", href: "/enquetes" }, { libelle: court(enquete.sujet) }]} actions={
          rapport ? (
            <>
              {connecte && <Suivre jeton={enquete.jeton} />}
              <Imprimer />
            </>
          ) : undefined
        }
      />

      <div className="flex flex-1 flex-col gap-4 px-4 py-5 md:px-7">
        <div className={`${CARTE} px-5 pt-[18px] ${rapport ? "" : "pb-[18px]"}`}>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">{enquete.sujet}</h1>
          <p className="mt-1.5 text-[13px] text-doux">
            {date} · {duree} · {lues} source{lues > 1 ? "s" : ""} lue{lues > 1 ? "s" : ""}
          </p>
          {rapport && (
            <nav aria-label="Sections du rapport" className="sans-impression mt-4 flex gap-6 overflow-x-auto font-semibold">
              {ONGLETS.map((o) => {
                const actif = o.id === onglet;
                return (
                  <Link
                    key={o.id}
                    href={o.id === "synthese" ? "?" : `?onglet=${o.id}`}
                    scroll={false}
                    aria-current={actif ? "page" : undefined}
                    className={`shrink-0 border-b-2 pb-3 no-underline transition-colors duration-150 ease-radar ${actif ? "border-vert text-vert" : "border-transparent text-doux hover:text-texte"}`}
                  >
                    {o.libelle}
                    {comptes[o.id] !== undefined && <span className="ml-1.5 font-normal">{comptes[o.id]}</span>}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        {interrompue && (
          <div role="status" className="rounded-carte bg-ambre-pale p-4 text-sm text-ambre-texte">
            <p>L&apos;enquête s&apos;est arrêtée : {erreurLisible(enquete.erreur)}. Elle reprendra toute seule dans les prochaines heures, ou tout de suite ici.</p>
            {connecte && <Reprendre jeton={enquete.jeton} />}
          </div>
        )}
        {enquete.statut === "echec" && (
          <div role="status" className="rounded-carte bg-rouge-pale p-4 text-sm text-rouge">
            L&apos;enquête a été abandonnée après plusieurs reprises sans succès : {erreurLisible(enquete.erreur)}.
          </div>
        )}

        {rapport ? (
          onglet === "concurrents" ? (
            <Concurrents rapport={rapport} />
          ) : onglet === "preuves" ? (
            <Preuves rapport={rapport} />
          ) : onglet === "sources" ? (
            <Sources sources={sources} rapport={rapport} />
          ) : onglet === "activite" ? (
            <Activite etapes={etapes} />
          ) : (
            <Synthese rapport={rapport} statut={enquete.statut} />
          )
        ) : (
          <VueDirect etapes={etapes} sources={sources} budget={enquete.budget} active={active && !interrompue} />
        )}
      </div>
    </>
  );
}
