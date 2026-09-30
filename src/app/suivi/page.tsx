import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { exigerContexte } from "@/lib/serveur/session";
import { STATUTS_SUIVI, suiviDe, type ElementSuivi } from "@/lib/serveur/suivi";
import { BarreHaut } from "../_ui/BarreHaut";
import { CARTE, CHAMP, dateCourte, tonEnquete } from "../_ui/styles";
import { libelleSecteur, versSujet } from "../_ui/sujet";
import { enregistrerSuivi, retirerSuivi } from "./actions";

export const metadata: Metadata = { title: "Suivi · Radar" };

const COULEURS: Record<ElementSuivi["statut"], string> = {
  a_creuser: "bg-ambre",
  entretien: "bg-graph-3",
  abandonnee: "bg-doux",
  lancee: "bg-vert",
};

export default function Suivi() {
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <BarreHaut chemin={[{ libelle: "Suivi des opportunités" }]} />
      <div className="flex flex-col gap-4 px-4 py-5 md:px-7">
        <Suspense fallback={<p className="text-doux">Chargement…</p>}>
          <Tableau />
        </Suspense>
      </div>
    </main>
  );
}

async function Tableau() {
  await connection();
  const c = await exigerContexte("/suivi");
  const elements = await suiviDe(c.equipe.id);
  return (
    <>
      <div className={`${CARTE} px-5 py-[18px]`}>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">À valider</h1>
        <p className="mt-1.5 text-[13px] text-doux">
          Les opportunités retenues par {c.equipe.nom}, de l&apos;idée à la décision. Ajoute-les depuis le classement ou depuis un rapport d&apos;enquête.
        </p>
      </div>
      {elements.length === 0 ? (
        <div className={`${CARTE} p-6 text-doux`}>
          Rien à suivre pour l&apos;instant.{" "}
          <Link href="/" className="font-semibold no-underline">
            Choisis une opportunité dans le classement
          </Link>
          .
        </div>
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
          {STATUTS_SUIVI.map((s) => {
            const liste = elements.filter((e) => e.statut === s.id);
            return (
              <section key={s.id} aria-labelledby={`col-${s.id}`} className="flex flex-col gap-2.5 rounded-carte bg-surface-2 p-3">
                <h2 id={`col-${s.id}`} className="flex items-center gap-2 px-1 text-[13px] font-bold">
                  <span className={`h-2 w-2 rounded-full ${COULEURS[s.id]}`} aria-hidden />
                  {s.libelle}
                  <span className="font-normal text-doux">{liste.length}</span>
                </h2>
                {liste.map((e) => (
                  <Carte key={e.id} e={e} />
                ))}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function Carte({ e }: { e: ElementSuivi }) {
  const ton = e.enquete ? tonEnquete(e.enquete) : null;
  return (
    <article className={`${CARTE} flex flex-col gap-2.5 p-3.5`}>
      <div>
        <h3 className="font-semibold leading-snug">{e.titre}</h3>
        <p className="mt-0.5 text-xs text-doux">
          {e.secteur ? `${libelleSecteur(e.secteur)} · ` : ""}
          {e.score !== null ? `score ${e.score.toFixed(1).replace(".", ",")} · ` : ""}
          modifié {dateCourte(e.maj_le)}
        </p>
      </div>
      {e.resume && <p className="line-clamp-3 text-[13px] leading-relaxed text-texte-2">{e.resume}</p>}
      {e.enquete ? (
        <Link href={`/enquete/${e.enquete.jeton}`} className="flex items-center gap-1.5 text-[13px] font-semibold no-underline">
          {ton && <span className={`h-[7px] w-[7px] rounded-full ${ton.point}`} aria-hidden />}
          Enquête : {ton?.libelle.toLowerCase()}
        </Link>
      ) : (
        <Link href={`/enquetes?${new URLSearchParams({ sujet: versSujet(e.titre) })}`} className="text-[13px] font-semibold no-underline">
          Lancer une enquête
        </Link>
      )}
      <form action={enregistrerSuivi.bind(null, e.id)} className="flex flex-col gap-2 border-t border-trait pt-2.5">
        <label className="flex flex-col gap-1 text-xs text-doux">
          Étape
          <select name="statut" defaultValue={e.statut} className={`${CHAMP} py-1.5 text-[13px]`}>
            {STATUTS_SUIVI.map((s) => (
              <option key={s.id} value={s.id}>
                {s.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-doux">
          Notes
          <textarea name="note" defaultValue={e.note ?? ""} maxLength={2000} rows={2} placeholder="Entretien avec…, prix acceptable…" className={`${CHAMP} resize-y py-1.5 text-[13px]`} />
        </label>
        <div className="flex items-center justify-between gap-2">
          <button type="submit" className="rounded-bouton bg-vert px-3 py-1.5 text-[13px] font-semibold text-white transition-colors duration-150 ease-radar hover:bg-vert-fonce">
            Enregistrer
          </button>
          <button formAction={retirerSuivi.bind(null, e.id)} className="rounded-bouton px-2 py-1.5 text-[13px] text-doux transition-colors duration-150 ease-radar hover:bg-surface-2 hover:text-rouge">
            Retirer
          </button>
        </div>
      </form>
    </article>
  );
}
