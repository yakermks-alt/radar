import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { topOpportunites } from "@/lib/serveur/base";
import { agentLancable, dernieresEnquetes, enquetesDuJour, ENQUETES_PAR_JOUR } from "@/lib/serveur/enquetes";
import { BarreHaut } from "../_ui/BarreHaut";
import { ListeEnquetes } from "../_ui/ListeEnquetes";
import { CARTE, dateCourte, tonEnquete } from "../_ui/styles";
import { versSujet } from "../_ui/sujet";
import { Formulaire } from "./Formulaire";

const ETAPES = [
  {
    titre: "1. L'agent cherche",
    texte: "Web, avis App Store, fiches officielles des entreprises et Insee.",
    icone: (
      <>
        <circle cx="9" cy="9" r="5.5" />
        <path d="M13 13 L17 17" />
      </>
    ),
  },
  {
    titre: "2. Il vérifie",
    texte: "Une affirmation sans citation exacte de sa source est retirée.",
    icone: (
      <>
        <path d="M4 4 H13 L16 7 V16 H4 Z" />
        <path d="M7 10 H13 M7 13 H11" />
      </>
    ),
  },
  { titre: "3. Il conclut", texte: "Verdict, prix, taille du marché, angle d'attaque, risques.", icone: <path d="M5 10.5 L8.5 14 L15 6.5" /> },
];

export default async function Enquetes({ searchParams }: PageProps<"/enquetes">) {
  const { sujet } = await searchParams;
  return (
    <>
      <ListeEnquetes nouvelleActive />
      <main className="flex min-w-0 flex-1 flex-col">
        <BarreHaut chemin={[{ libelle: "Enquêtes", href: "/enquetes" }, { libelle: "Nouvelle enquête" }]} />
        <div className="flex justify-center px-4 py-8 md:px-7 md:py-10">
          <div className="flex w-full max-w-[760px] flex-col gap-5">
            <div>
              <h1 className="text-2xl font-bold tracking-[-0.02em]">Sur quel marché veux-tu enquêter ?</h1>
              <p className="mt-2 leading-relaxed text-texte-2">
                L&apos;agent cherche les concurrents et leurs prix, lit les plaintes des clients et compte les entreprises du métier. Chaque affirmation de son rapport cite sa source mot pour mot.
              </p>
            </div>
            <Suspense fallback={<div className={`${CARTE} h-72`} />}>
              <FormulaireDynamique sujet={typeof sujet === "string" ? sujet.slice(0, 200) : ""} />
            </Suspense>
            <div className="grid gap-3.5 sm:grid-cols-3">
              {ETAPES.map((e) => (
                <div key={e.titre} className={`${CARTE} p-4`}>
                  <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="var(--color-vert)" strokeWidth="1.6" aria-hidden>
                    {e.icone}
                  </svg>
                  <div className="mt-2 font-semibold">{e.titre}</div>
                  <div className="mt-1 text-[13px] leading-snug text-doux">{e.texte}</div>
                </div>
              ))}
            </div>
            <Suspense fallback={null}>
              <ListeMobile />
            </Suspense>
          </div>
        </div>
      </main>
    </>
  );
}

async function FormulaireDynamique({ sujet }: { sujet: string }) {
  await connection();
  const [top, faites] = await Promise.all([topOpportunites(4).catch(() => []), enquetesDuJour()]);
  if (!agentLancable() && process.env.NODE_ENV === "production") {
    return <p className={`${CARTE} p-6 text-doux`}>Le lancement d&apos;enquêtes n&apos;est pas encore branché sur ce site.</p>;
  }
  return (
    <Formulaire
      sujetInitial={sujet}
      codeDemande={Boolean(process.env.RADAR_CODE_ACCES)}
      idees={top.map((o) => versSujet(o.nom))}
      restantes={Math.max(0, ENQUETES_PAR_JOUR - faites)}
    />
  );
}

// Sur téléphone et petit écran, la colonne des enquêtes est masquée : on les liste ici.
async function ListeMobile() {
  await connection();
  const enquetes = await dernieresEnquetes(10);
  if (!enquetes.length) return null;
  return (
    <section className={`${CARTE} p-4 lg:hidden`}>
      <h2 className="mb-2 text-base font-bold">Tes enquêtes</h2>
      <ul>
        {enquetes.map((e) => {
          const ton = tonEnquete(e);
          return (
            <li key={e.jeton} className="border-b border-trait last:border-b-0">
              <Link href={`/enquete/${e.jeton}`} className="flex items-center justify-between gap-3 py-2.5 text-texte no-underline">
                <span className="min-w-0 truncate font-semibold">{e.sujet}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-xs">
                  <span className={`h-[7px] w-[7px] rounded-full ${ton.point}`} aria-hidden />
                  <span className={ton.texte}>{ton.libelle}</span>
                  <span className="text-doux">· {dateCourte(e.cree_le)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
