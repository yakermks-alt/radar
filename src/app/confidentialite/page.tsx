import type { Metadata } from "next";
import Link from "next/link";
import { CARTE } from "../_ui/styles";

export const metadata: Metadata = { title: "Confidentialité · Radar" };

// Politique de confidentialité (RGPD). Le nom du responsable et l'adresse de contact viennent des
// variables du site : le dépôt est public, aucune donnée personnelle n'est écrite dans le code.
export default function Confidentialite() {
  const responsable = process.env.RADAR_RESPONSABLE ?? "l'éditeur de Radar";
  const contact = process.env.RADAR_CONTACT;
  const T = "mt-6 text-base font-bold";
  const P = "mt-2 leading-relaxed text-texte-2";
  return (
    <main className="flex flex-1 justify-center px-4 py-8 md:py-12">
      <article className={`${CARTE} w-full max-w-[720px] p-6 md:p-8`}>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Politique de confidentialité</h1>
        <p className="mt-1.5 text-[13px] text-doux">Mise à jour le 30 septembre 2026</p>

        <p className={P}>
          Radar est un projet personnel et gratuit, publié par {responsable}, responsable du traitement des données décrites ici. Radar ne vend aucune donnée, n&apos;affiche aucune publicité et ne
          dépose aucun cookie de suivi.
        </p>

        <h2 className={T}>Ce que Radar enregistre</h2>
        <ul className={`${P} list-disc pl-5`}>
          <li>Ton nom et ton adresse email, transmis par Google ou GitHub quand tu te connectes (jamais ton mot de passe ni tes contacts).</li>
          <li>Tes équipes, les opportunités que tu suis et les notes que tu y écris.</li>
          <li>Les sujets des enquêtes lancées par ton équipe et leurs rapports.</li>
          <li>Tes réglages d&apos;email (email du matin, secteurs suivis) et la liste des opportunités déjà envoyées, pour ne pas te les renvoyer.</li>
          <li>Pour l&apos;offre Pro (mode test uniquement) : un identifiant client chez Stripe et l&apos;état de l&apos;abonnement. Aucune carte bancaire n&apos;est vue ni stockée par Radar.</li>
        </ul>

        <h2 className={T}>Pourquoi</h2>
        <p className={P}>
          Uniquement pour faire fonctionner le service que tu utilises : te connecter, partager le travail de ton équipe, t&apos;envoyer l&apos;email du matin si tu l&apos;as activé, et gérer
          l&apos;abonnement. Base légale : l&apos;exécution du service que tu demandes.
        </p>

        <h2 className={T}>Qui les traite</h2>
        <ul className={`${P} list-disc pl-5`}>
          <li>Supabase : base de données et connexion.</li>
          <li>Netlify : hébergement du site.</li>
          <li>GitHub : exécution de l&apos;agent enquêteur et des tâches automatiques.</li>
          <li>Resend : envoi de l&apos;email du matin.</li>
          <li>Stripe : paiement de l&apos;offre Pro, en mode test.</li>
          <li>Google (Gemini) et Tavily : reçoivent les sujets d&apos;enquête et les pages web étudiées, jamais ton nom ni ton email.</li>
        </ul>
        <p className={P}>Certains de ces services sont situés hors de l&apos;Union européenne ; ils s&apos;engagent par des clauses contractuelles types de la Commission européenne.</p>

        <h2 className={T}>Combien de temps</h2>
        <p className={P}>
          Tant que ton compte existe. Quand tu le supprimes, ton profil, tes réglages et l&apos;historique de tes emails sont effacés aussitôt. Les enquêtes restent à leur équipe, sans ton nom.
        </p>

        <h2 className={T}>Tes droits</h2>
        <p className={P}>
          Tu peux consulter et corriger tes informations, et supprimer ton compte toi-même depuis la page{" "}
          <Link href="/compte" className="font-semibold no-underline">
            Mon compte
          </Link>
          . Pour toute autre demande (accès, opposition, portabilité),{" "}
          {contact ? (
            <>
              écris à{" "}
              <a href={`mailto:${contact}`} className="font-semibold no-underline">
                {contact}
              </a>
            </>
          ) : (
            "contacte l'éditeur"
          )}
          . Tu peux aussi saisir la CNIL (cnil.fr).
        </p>

        <h2 className={T}>Cookies</h2>
        <p className={P}>Un seul type de cookie : celui de ta session de connexion, indispensable au service. Aucun cookie de mesure d&apos;audience ni de publicité.</p>
      </article>
    </main>
  );
}
