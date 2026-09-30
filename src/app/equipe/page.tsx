import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { adresseSite } from "@/lib/env";
import { OFFRES } from "@/lib/offres";
import { equipesDe, invitationsDe, membresDe } from "@/lib/serveur/comptes";
import { stripeActif } from "@/lib/serveur/paiement";
import { exigerContexte } from "@/lib/serveur/session";
import { BarreHaut } from "../_ui/BarreHaut";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, CARTE, CHAMP, dateCourte } from "../_ui/styles";
import { basculer, gererAbonnement, inviter, passerPro, quitter, renommer, retirer, supprimerLien } from "./actions";
import { Copier } from "./Copier";

export const metadata: Metadata = { title: "Équipe · Radar" };

export default async function Equipe({ searchParams }: PageProps<"/equipe">) {
  const sp = await searchParams;
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <BarreHaut chemin={[{ libelle: "Équipe" }]} />
      <div className="flex justify-center px-4 py-5 md:px-7 md:py-8">
        <div className="flex w-full max-w-[820px] flex-col gap-4">
          <Suspense fallback={<p className="text-doux">Chargement…</p>}>
            <Contenu message={typeof sp.message === "string" ? sp.message.slice(0, 200) : null} paiement={typeof sp.paiement === "string" ? sp.paiement : null} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

const TITRE = "text-base font-bold";

async function Contenu({ message, paiement }: { message: string | null; paiement: string | null }) {
  await connection();
  const c = await exigerContexte("/equipe");
  const proprio = c.equipe.role === "proprietaire";
  const [membres, invitations, equipes] = await Promise.all([membresDe(c.equipe.id), proprio ? invitationsDe(c.equipe.id) : [], equipesDe(c.utilisateur.id)]);
  const site = adresseSite();
  const offre = OFFRES[c.equipe.plan];

  return (
    <>
      {message && (
        <p role="alert" className="rounded-bouton bg-ambre-pale px-4 py-3 text-sm text-ambre-texte">
          {message}
        </p>
      )}
      {paiement === "ok" && c.equipe.plan !== "pro" && (
        <p role="status" className="rounded-bouton bg-vert-clair px-4 py-3 text-sm text-vert-texte">
          Paiement reçu. L&apos;offre Pro s&apos;active dès que Stripe le confirme (quelques secondes) : recharge la page.
        </p>
      )}

      <div className={`${CARTE} flex flex-wrap items-start justify-between gap-4 px-5 py-[18px]`}>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-[-0.02em]">{c.equipe.nom}</h1>
          <p className="mt-1.5 text-[13px] text-doux">
            Offre {offre.nom} · {membres.length} membre{membres.length > 1 ? "s" : ""} sur {offre.membres} · tu es {proprio ? "propriétaire" : "membre"}
          </p>
        </div>
        {proprio && (
          <form action={renommer} className="flex gap-2">
            <label className="sr-only" htmlFor="nom-equipe">
              Nom de l&apos;équipe
            </label>
            <input id="nom-equipe" name="nom" defaultValue={c.equipe.nom} maxLength={60} required className={`${CHAMP} w-52 py-2 text-sm`} />
            <button type="submit" className={BOUTON_SECONDAIRE}>
              Renommer
            </button>
          </form>
        )}
      </div>

      {equipes.length > 1 && (
        <section className={`${CARTE} p-5`}>
          <h2 className={TITRE}>Tes équipes</h2>
          <form action={basculer} className="mt-3 flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="choix-equipe">
              Équipe active
            </label>
            <select id="choix-equipe" name="equipe" defaultValue={c.equipe.id} className={`${CHAMP} w-auto py-2 text-sm`}>
              {equipes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom} ({OFFRES[e.plan].nom})
                </option>
              ))}
            </select>
            <button type="submit" className={BOUTON_SECONDAIRE}>
              Changer d&apos;équipe
            </button>
          </form>
        </section>
      )}

      <section className={`${CARTE} p-5`}>
        <h2 className={TITRE}>Membres</h2>
        <ul className="mt-2">
          {membres.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-trait py-2.5 last:border-b-0">
              <div className="min-w-0">
                <div className="truncate font-semibold">
                  {m.nom ?? m.email}
                  {m.id === c.utilisateur.id && <span className="ml-1.5 font-normal text-doux">(toi)</span>}
                </div>
                <div className="truncate text-xs text-doux">
                  {m.email} · {m.role === "proprietaire" ? "propriétaire" : "membre"} depuis {dateCourte(m.depuis)}
                </div>
              </div>
              {proprio && m.id !== c.utilisateur.id && (
                <form action={retirer.bind(null, m.id)}>
                  <button type="submit" className="rounded-bouton px-2.5 py-1.5 text-[13px] text-doux transition-colors duration-150 ease-radar hover:bg-rouge-pale hover:text-rouge">
                    Retirer
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <form action={quitter} className="mt-3 border-t border-trait pt-3">
          <button type="submit" className="text-[13px] text-doux underline-offset-2 hover:text-rouge hover:underline">
            Quitter cette équipe
          </button>
        </form>
      </section>

      {proprio && (
        <section className={`${CARTE} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className={TITRE}>Inviter</h2>
              <p className="mt-1 text-[13px] text-doux">Un lien vaut 5 personnes pendant 7 jours. Envoie-le à qui tu veux ; supprime-le s&apos;il circule trop.</p>
            </div>
            <form action={inviter}>
              <button type="submit" disabled={invitations.length >= 3 || membres.length >= offre.membres} className={BOUTON_PRINCIPAL}>
                Créer un lien
              </button>
            </form>
          </div>
          {invitations.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {invitations.map((i) => (
                <li key={i.jeton} className="flex flex-wrap items-center gap-2 rounded-bouton bg-surface-2 p-2.5">
                  <Copier texte={`${site}/rejoindre/${i.jeton}`} />
                  <span className="text-xs text-doux">
                    {i.usages}/{i.usagesMax} utilisé{i.usages > 1 ? "s" : ""} · expire {dateCourte(i.expireLe)}
                  </span>
                  <form action={supprimerLien.bind(null, i.jeton)} className="ml-auto">
                    <button type="submit" className="rounded-bouton px-2 py-1 text-[13px] text-doux hover:bg-rouge-pale hover:text-rouge">
                      Supprimer
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section id="offre" className={`${CARTE} p-5`}>
        <h2 className={TITRE}>Offre</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(["gratuit", "pro"] as const).map((p) => {
            const o = OFFRES[p];
            const actuelle = c.equipe.plan === p;
            return (
              <div key={p} className={`rounded-bouton border p-4 ${actuelle ? "border-vert bg-vert-clair" : "border-bordure"}`}>
                <div className="flex items-baseline justify-between">
                  <span className="font-bold">{o.nom}</span>
                  <span className="chiffres text-xl font-bold">
                    {o.prixMois} €<span className="text-xs font-normal text-doux"> HT/mois</span>
                  </span>
                </div>
                <ul className="mt-2 flex flex-col gap-1 text-[13px] text-texte-2">
                  <li>{p === "pro" ? "Tout le Top 20" : `${o.opportunites} opportunités par jour`}</li>
                  <li>{p === "pro" ? `${o.enquetesJour} enquêtes par jour` : `${o.enquetesSemaine} enquête par semaine`}</li>
                  <li>Jusqu&apos;à {o.membres} membres</li>
                  <li>{o.alertes ? "Alertes par secteur dans l'email du matin" : "Email du matin : 3 opportunités"}</li>
                </ul>
                {actuelle && <div className="mt-3 text-xs font-semibold text-vert-texte">Offre actuelle</div>}
              </div>
            );
          })}
        </div>
        <Abonnement plan={c.equipe.plan} proprio={proprio} statut={c.equipe.abonnementStatut} fin={c.equipe.finPeriode} />
      </section>
    </>
  );
}

function Abonnement({ plan, proprio, statut, fin }: { plan: "gratuit" | "pro"; proprio: boolean; statut: string | null; fin: string | null }) {
  if (!stripeActif()) return <p className="mt-3 text-[13px] text-doux">Le paiement n&apos;est pas encore branché sur ce site.</p>;
  if (!proprio) return <p className="mt-3 text-[13px] text-doux">Seul le propriétaire de l&apos;équipe peut changer d&apos;offre.</p>;
  const date = fin ? new Date(fin).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" }) : null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-trait pt-4">
      <p className="text-[13px] text-doux">
        {plan === "pro"
          ? statut === "resiliation_prevue"
            ? `Résiliation prévue : l'offre Pro s'arrête le ${date}.`
            : statut === "past_due"
              ? "Dernier paiement refusé : Stripe réessaie. Mets à jour ta carte."
              : `Prochain renouvellement le ${date}.`
          : "Mode test Stripe : paye avec la carte 4242 4242 4242 4242, date future, n'importe quel code."}
      </p>
      <form action={plan === "pro" ? gererAbonnement : passerPro}>
        <button type="submit" className={plan === "pro" ? BOUTON_SECONDAIRE : BOUTON_PRINCIPAL}>
          {plan === "pro" ? "Gérer l'abonnement" : "Passer à Pro"}
        </button>
      </form>
    </div>
  );
}
