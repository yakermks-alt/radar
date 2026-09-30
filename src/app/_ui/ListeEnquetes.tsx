import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { OFFRES } from "@/lib/offres";
import { dernieresEnquetes, quotaEquipe } from "@/lib/serveur/enquetes";
import { contexte } from "@/lib/serveur/session";
import { BOUTON_PRINCIPAL, dateCourte, tonEnquete } from "./styles";

// Deuxième colonne : les enquêtes (choix de Maksen, navigation V4). Masquée sur petit écran, où la
// page « Enquêtes » affiche la même liste sous le formulaire.
// Personne connectée seulement (un rapport partagé par lien s'affiche sans la colonne).
export async function ListeEnquetes({ jetonActif, nouvelleActive = false }: { jetonActif?: string; nouvelleActive?: boolean }) {
  await connection();
  const c = await contexte();
  if (!c) return null;
  return (
    <aside aria-label="Tes enquêtes" className="sans-impression hidden w-[264px] shrink-0 flex-col gap-1.5 border-r border-bordure bg-surface px-3.5 py-5 lg:flex lg:h-screen lg:sticky lg:top-0">
      <div className="px-2 pb-3 text-base font-bold">Enquêtes</div>
      <Link
        href="/enquetes"
        aria-current={nouvelleActive ? "page" : undefined}
        className={
          nouvelleActive
            ? "mx-1 mb-3.5 rounded-bouton border border-vert bg-vert-clair px-3 py-2.5 font-semibold text-vert-fonce no-underline"
            : `${BOUTON_PRINCIPAL} mx-1 mb-3.5 justify-start no-underline`
        }
      >
        + Nouvelle enquête
      </Link>
      <Suspense fallback={<p className="px-3 text-[13px] text-doux">Chargement…</p>}>
        <Elements jetonActif={jetonActif} equipe={c.equipe} />
      </Suspense>
    </aside>
  );
}

async function Elements({ jetonActif, equipe }: { jetonActif?: string; equipe: { id: number; plan: "gratuit" | "pro" } }) {
  const [enquetes, quota] = await Promise.all([dernieresEnquetes(equipe.id, 30), quotaEquipe(equipe.id, equipe.plan)]);
  const offre = OFFRES[equipe.plan];
  const total = equipe.plan === "gratuit" ? offre.enquetesSemaine : offre.enquetesJour;
  const faites = total - Math.min(total, quota.restantes);
  return (
    <>
      <nav aria-label="Enquêtes récentes" className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1">
        {enquetes.length === 0 && <p className="px-3 text-[13px] leading-relaxed text-doux">Aucune enquête pour l&apos;instant. Lance la première à partir d&apos;une opportunité du classement.</p>}
        {enquetes.map((e) => {
          const ton = tonEnquete(e);
          const actif = e.jeton === jetonActif;
          const detail = ton.libelle === "En cours" ? `étape ${Math.min(e.etapes_faites + 1, e.budget)}` : dateCourte(e.cree_le);
          return (
            <Link
              key={e.jeton}
              href={`/enquete/${e.jeton}`}
              aria-current={actif ? "page" : undefined}
              className={`rounded-bouton px-3 py-2.5 text-texte no-underline transition-colors duration-150 ease-radar ${actif ? "bg-vert-clair" : "hover:bg-surface-2"}`}
            >
              <div className="truncate font-semibold">{e.sujet}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs">
                <span className={`h-[7px] w-[7px] rounded-full ${ton.point}`} aria-hidden />
                <span className={ton.texte}>{ton.libelle}</span>
                <span className="text-doux">· {detail}</span>
              </div>
            </Link>
          );
        })}
      </nav>
      <div className="mt-2 rounded-bouton bg-fond p-3">
        <div className="text-[13px] font-semibold">Offre {offre.nom}</div>
        <div className="mt-0.5 text-xs text-doux">
          {faites} enquête{faites > 1 ? "s" : ""} sur {total} {quota.periode === "semaine" ? "cette semaine" : "aujourd'hui"}
        </div>
        <div className="mt-2 h-[5px] rounded-full bg-bordure" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={faites} aria-label="Enquêtes utilisées">
          <div className="h-full rounded-full bg-vert" style={{ width: `${Math.min(100, (faites / total) * 100)}%` }} />
        </div>
      </div>
    </>
  );
}
