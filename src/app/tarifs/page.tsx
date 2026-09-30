import type { Metadata } from "next";
import Link from "next/link";
import { OFFRES } from "@/lib/offres";
import { contexte } from "@/lib/serveur/session";
import { EnTetePublic, PiedPublic } from "../_ui/Vitrine";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, CARTE } from "../_ui/styles";

export const metadata: Metadata = { title: "Tarifs · Radar", description: "Radar gratuit ou Pro : opportunités business, enquêtes sourcées et alertes par secteur." };

const QUESTIONS = [
  ["Le paiement est-il réel ?", "Non. Radar est un projet de démonstration : Stripe est en mode test, seules les cartes de test sont acceptées et aucune somme n'est débitée."],
  ["Qu'est-ce qu'une enquête ?", "Un agent étudie un marché pour toi : concurrents et prix, plaintes des clients, nombre d'entreprises du métier. Chaque phrase du rapport cite sa source mot pour mot."],
  ["Puis-je changer d'offre ?", "Oui, à tout moment depuis la page Équipe. Une résiliation prend effet à la fin du mois payé."],
];

export default async function Tarifs() {
  const c = await contexte();
  const versPro = c ? "/equipe#offre" : `/connexion?${new URLSearchParams({ suivant: "/equipe#offre" })}`;
  const offres = [
    {
      o: OFFRES.gratuit,
      points: [`${OFFRES.gratuit.opportunites} opportunités par jour, un nouveau lot chaque jour`, `${OFFRES.gratuit.enquetesSemaine} enquête par semaine`, `Tableau de suivi et équipe jusqu'à ${OFFRES.gratuit.membres}`, "Email du matin"],
      action: (
        <Link href={c ? "/" : "/connexion"} className={`${BOUTON_SECONDAIRE} no-underline`}>
          {c ? "Ouvrir Radar" : "Commencer"}
        </Link>
      ),
    },
    {
      o: OFFRES.pro,
      points: [`Tout le Top ${OFFRES.pro.opportunites}, chaque jour`, `${OFFRES.pro.enquetesJour} enquêtes par jour`, `Équipe jusqu'à ${OFFRES.pro.membres} personnes`, "Alertes par secteur dans l'email du matin"],
      action: (
        <Link href={versPro} className={`${BOUTON_PRINCIPAL} no-underline`}>
          Passer à Pro
        </Link>
      ),
    },
  ];

  return (
    <div className="flex min-h-screen w-full flex-col">
      <EnTetePublic
        action={
          <Link href={c ? "/" : "/connexion"} className={`${BOUTON_SECONDAIRE} no-underline`}>
            {c ? "Ouvrir Radar" : "Se connecter"}
          </Link>
        }
      />
      <main className="mx-auto flex w-full max-w-[1120px] flex-col items-center gap-7 px-4 pt-8 pb-12 md:px-7 md:pt-12">
        <div className="flex max-w-[620px] flex-col items-center gap-2.5 text-center">
          <h1 className="text-[clamp(28px,4vw,38px)] font-extrabold tracking-[-0.03em]">Tarifs</h1>
          <p className="text-base leading-relaxed text-texte-2">Commence gratuitement. Passe à Pro quand Radar devient ton outil de veille.</p>
          <span className="rounded-full bg-ambre-pale px-3 py-1 text-xs font-semibold text-ambre-texte">Paiement en mode test : aucune carte réelle n&apos;est débitée</span>
        </div>
        <div className="grid w-full max-w-[760px] gap-4 md:grid-cols-2">
          {offres.map(({ o, points, action }) => {
            const pro = o === OFFRES.pro;
            return (
              <section key={o.nom} aria-label={`Offre ${o.nom}`} className={`${CARTE} flex flex-col gap-4 p-6 ${pro ? "border-2 border-vert" : "border border-bordure"}`}>
                <div className="flex items-center justify-between">
                  <h2 className="text-[17px] font-bold">{o.nom}</h2>
                  {pro && <span className="rounded-full bg-vert-clair px-2.5 py-0.5 text-xs font-semibold text-vert-texte">Le plus complet</span>}
                </div>
                <div className="chiffres text-[34px] font-extrabold tracking-[-0.02em]">
                  {o.prixMois} €{pro && <span className="ml-1.5 text-sm font-medium text-doux">HT par mois</span>}
                </div>
                <ul className="flex flex-col gap-2 text-texte-2">
                  {points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span aria-hidden className="font-extrabold text-vert">
                        ✓
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex">{action}</div>
              </section>
            );
          })}
        </div>
        <section aria-label="Questions fréquentes" className="grid w-full max-w-[760px] gap-3">
          {QUESTIONS.map(([q, r]) => (
            <div key={q} className={`${CARTE} p-4`}>
              <h2 className="font-semibold">{q}</h2>
              <p className="mt-1 text-[13.5px] leading-relaxed text-doux">{r}</p>
            </div>
          ))}
        </section>
      </main>
      <PiedPublic />
    </div>
  );
}
