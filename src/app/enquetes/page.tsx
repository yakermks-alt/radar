import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { dernieresEnquetes, ENQUETES_PAR_JOUR } from "@/lib/serveur/enquetes";
import { Formulaire } from "./Formulaire";
import { LIBELLES_STATUT } from "./statuts";

export default async function Enquetes({ searchParams }: PageProps<"/enquetes">) {
  const { sujet } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <header className="mb-8">
        <Link href="/" className="text-sm font-medium uppercase tracking-wider text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
          Radar
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Enquêtes</h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Un agent IA enquête seul : concurrents et prix, plaintes des clients, taille du marché. Chaque affirmation de son
          rapport cite mot pour mot une source qu&apos;il a lue. {ENQUETES_PAR_JOUR} enquêtes par jour au maximum.
        </p>
      </header>

      <Suspense fallback={null}>
        <FormulaireDynamique sujet={typeof sujet === "string" ? sujet.slice(0, 200) : ""} />
      </Suspense>

      <h2 className="mb-4 mt-12 text-lg font-semibold">Dernières enquêtes</h2>
      <Suspense fallback={<p className="text-neutral-500">Chargement…</p>}>
        <Liste />
      </Suspense>
    </main>
  );
}

async function FormulaireDynamique({ sujet }: { sujet: string }) {
  await connection();
  return <Formulaire sujetInitial={sujet} codeDemande={Boolean(process.env.RADAR_CODE_ACCES)} />;
}

async function Liste() {
  await connection();
  const enquetes = await dernieresEnquetes(20);
  if (!enquetes.length) return <p className="text-neutral-500">Aucune enquête pour l&apos;instant.</p>;
  return (
    <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
      {enquetes.map((e) => (
        <li key={e.jeton}>
          <Link href={`/enquete/${e.jeton}`} className="flex items-baseline justify-between gap-4 py-3 hover:text-neutral-600 dark:hover:text-neutral-300">
            <span className="min-w-0 truncate">{e.sujet}</span>
            <span className="shrink-0 text-sm text-neutral-500">
              {LIBELLES_STATUT[e.statut]} · {new Date(e.cree_le).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" })}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
