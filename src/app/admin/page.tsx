import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ENQUETES_SITE_PAR_JOUR } from "@/lib/offres";
import { vueAdmin } from "@/lib/serveur/admin";
import { exigerContexte } from "@/lib/serveur/session";
import { BarreHaut } from "../_ui/BarreHaut";
import { erreurLisible } from "../_ui/erreurs";
import { CARTE, dateCourte } from "../_ui/styles";

export const metadata: Metadata = { title: "Administration · Radar" };

const RECHERCHES_MOIS = 900; // plafond fixé sous les 1 000 recherches gratuites de Tavily

export default function Admin() {
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <BarreHaut chemin={[{ libelle: "Administration" }]} />
      <div className="flex flex-col gap-4 px-4 py-5 md:px-7">
        <Suspense fallback={<p className="text-doux">Chargement…</p>}>
          <Contenu />
        </Suspense>
      </div>
    </main>
  );
}

function Chiffre({ libelle, valeur, detail }: { libelle: string; valeur: string | number; detail?: string }) {
  return (
    <div className={`${CARTE} p-4`}>
      <div className="text-[13px] text-doux">{libelle}</div>
      <div className="mt-1 text-2xl font-bold">{valeur}</div>
      {detail && <div className="mt-0.5 text-xs text-doux">{detail}</div>}
    </div>
  );
}

function Jauge({ libelle, valeur, max }: { libelle: string; valeur: number; max: number }) {
  const part = Math.min(100, (valeur / max) * 100);
  return (
    <div>
      <div className="flex justify-between text-[13px]">
        <span>{libelle}</span>
        <span className="chiffres text-doux">
          {valeur} / {max}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-trait" role="progressbar" aria-label={libelle} aria-valuemin={0} aria-valuemax={max} aria-valuenow={valeur}>
        <div className={`h-full rounded-full ${part >= 90 ? "bg-rouge" : part >= 70 ? "bg-ambre" : "bg-vert"}`} style={{ width: `${part}%` }} />
      </div>
    </div>
  );
}

async function Contenu() {
  await connection();
  const c = await exigerContexte("/admin");
  if (!c.utilisateur.admin) notFound(); // on ne révèle même pas que la page existe
  const v = await vueAdmin();

  return (
    <>
      <div className={`${CARTE} px-5 py-[18px]`}>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Administration</h1>
        <p className="mt-1.5 text-[13px] text-doux">Utilisateurs, enquêtes, erreurs et quotas gratuits. Lecture seule.</p>
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Chiffre libelle="Utilisateurs" valeur={v.utilisateurs.length} />
        <Chiffre libelle="Équipes" valeur={v.equipes.total} detail={`${v.equipes.pro} en Pro (mode test)`} />
        <Chiffre libelle="Enquêtes, 24 h" valeur={v.enquetes.jour} detail={`${v.enquetes.semaine} sur 7 jours`} />
        <Chiffre
          libelle="Email du matin"
          valeur={v.emails ? v.emails.envoyes : "–"}
          detail={v.emails ? `envoyés le ${dateCourte(v.emails.jour)}, ${v.emails.refuses} refusés` : "aucun envoi pour l'instant"}
        />
      </div>

      <section className={`${CARTE} flex flex-col gap-3.5 p-5`}>
        <h2 className="text-base font-bold">Quotas gratuits</h2>
        <Jauge libelle="Recherches web ce mois-ci (Tavily)" valeur={v.quotas.recherchesMois} max={RECHERCHES_MOIS} />
        <Jauge libelle="Enquêtes sur 24 h (tout le site)" valeur={v.quotas.enquetesJour} max={ENQUETES_SITE_PAR_JOUR} />
        <p className="text-xs text-doux">
          7 derniers jours : {Object.entries(v.enquetes.parStatut).map(([s, n]) => `${n} ${s.replace("_", " ")}`).join(", ") || "aucune enquête"}.
        </p>
      </section>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <section className={`${CARTE} p-5`}>
          <h2 className="text-base font-bold">Enquêtes en erreur</h2>
          {v.enquetes.echecs.length === 0 ? (
            <p className="mt-2 text-[13px] text-doux">Aucune.</p>
          ) : (
            <ul className="mt-2">
              {v.enquetes.echecs.map((e) => (
                <li key={e.jeton} className="border-b border-trait py-2 last:border-b-0">
                  <a href={`/enquete/${e.jeton}`} className="font-semibold no-underline">
                    {e.sujet}
                  </a>
                  <div className="text-xs text-doux">
                    {dateCourte(e.maj_le)} · {erreurLisible(e.erreur)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={`${CARTE} p-5`}>
          <h2 className="text-base font-bold">Tâches de nuit</h2>
          <ul className="mt-2">
            {v.journal.map((j, i) => (
              <li key={i} className="flex items-start justify-between gap-3 border-b border-trait py-2 text-[13px] last:border-b-0">
                <span>
                  <span className="font-semibold">{j.tache}</span>
                  {j.erreur && <span className="block text-xs text-rouge">{j.erreur.slice(0, 140)}</span>}
                </span>
                <span className={`shrink-0 ${j.statut === "erreur" ? "text-rouge" : j.statut === "ok" ? "text-vert-texte" : "text-doux"}`}>
                  {j.statut} · {dateCourte(j.demarre_le)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={`${CARTE} overflow-x-auto`}>
        <h2 className="px-5 pt-5 text-base font-bold">Utilisateurs</h2>
        <table className="mt-2 w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-surface-2 text-left text-doux">
              <th className="px-5 py-2 font-semibold">Personne</th>
              <th className="px-3 py-2 font-semibold">Équipe active</th>
              <th className="px-3 py-2 font-semibold">Offre</th>
              <th className="px-3 py-2 font-semibold">Inscrite</th>
              <th className="px-5 py-2 font-semibold">Vue</th>
            </tr>
          </thead>
          <tbody>
            {v.utilisateurs.map((u) => (
              <tr key={u.id} className="border-t border-trait">
                <td className="px-5 py-2">
                  <div className="font-semibold">
                    {u.nom ?? "–"}
                    {u.admin && <span className="ml-1.5 rounded-full bg-vert-clair px-2 py-0.5 text-[11px] text-vert-texte">admin</span>}
                  </div>
                  <div className="text-xs text-doux">{u.email}</div>
                </td>
                <td className="px-3 py-2">{u.equipe ?? "–"}</td>
                <td className="px-3 py-2">{u.plan ?? "–"}</td>
                <td className="px-3 py-2">{dateCourte(u.cree_le)}</td>
                <td className="px-5 py-2">{dateCourte(u.vu_le)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
