import Link from "next/link";
import { cookies } from "next/headers";
import { baseServeur } from "@/lib/serveur/base";
import type { Contexte } from "@/lib/serveur/session";
import { masquerGuide } from "../actions";
import { CARTE } from "./styles";

export const COOKIE_GUIDE = "radar_guide";

// Première connexion guidée : 3 étapes qui se cochent d'elles-mêmes d'après ce que l'équipe a fait.
// Disparaît quand tout est fait, ou quand la personne la masque (cookie, un an).
export async function Guide({ c }: { c: Contexte }) {
  if ((await cookies()).get(COOKIE_GUIDE)?.value === "masque") return null;
  const db = baseServeur();
  const compter = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [suivis, enquetes, membres, liens] = await Promise.all([
    compter(db.from("suivi").select("id", { count: "exact", head: true }).eq("equipe_id", c.equipe.id)),
    compter(db.from("enquetes").select("id", { count: "exact", head: true }).eq("equipe_id", c.equipe.id)),
    compter(db.from("membres").select("utilisateur_id", { count: "exact", head: true }).eq("equipe_id", c.equipe.id)),
    compter(db.from("invitations").select("id", { count: "exact", head: true }).eq("equipe_id", c.equipe.id)),
  ]);
  const etapes = [
    { fait: suivis > 0, titre: "Suis une opportunité", texte: "Clique sur « Suivre » dans le classement ci-dessous : elle rejoint ton tableau de suivi.", href: null },
    { fait: enquetes > 0, titre: "Lance une enquête", texte: "L'agent étudie les concurrents, les prix et la taille du marché, en une minute et demie.", href: "/enquetes" },
    { fait: membres > 1 || liens > 0, titre: "Invite ton associé", texte: "Un lien à envoyer, et vous partagez le suivi et les enquêtes.", href: "/equipe" },
  ];
  const faites = etapes.filter((e) => e.fait).length;
  if (faites === etapes.length) return null;
  const prenom = c.utilisateur.nom?.split(" ")[0];

  return (
    <section aria-labelledby="guide-titre" className={`${CARTE} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="guide-titre" className="text-base font-bold">
            Bien démarrer{prenom ? `, ${prenom}` : ""}
          </h2>
          <p className="mt-1 text-[13px] text-doux">
            {faites} étape{faites > 1 ? "s" : ""} sur {etapes.length} · Radar repère des besoins que les logiciels actuels couvrent mal, à partir des plaintes de leurs clients.
          </p>
        </div>
        <form action={masquerGuide}>
          <button type="submit" className="rounded-bouton px-2.5 py-1.5 text-[13px] text-doux transition-colors duration-150 ease-radar hover:bg-surface-2 hover:text-texte">
            Masquer
          </button>
        </form>
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-3">
        {etapes.map((e, i) => (
          <li key={e.titre} className={`flex gap-3 rounded-bouton p-3.5 ${e.fait ? "bg-vert-clair" : "bg-surface-2"}`}>
            <span
              aria-hidden
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${e.fait ? "bg-vert text-white" : "border border-bordure bg-surface text-doux"}`}
            >
              {e.fait ? "✓" : i + 1}
            </span>
            <div className="min-w-0">
              <div className={`font-semibold ${e.fait ? "text-vert-texte" : ""}`}>
                {e.titre}
                {e.fait && <span className="sr-only"> (fait)</span>}
              </div>
              <p className="mt-0.5 text-[13px] leading-snug text-doux">{e.texte}</p>
              {!e.fait && e.href && (
                <Link href={e.href} className="mt-1.5 inline-block text-[13px] font-semibold text-vert no-underline hover:text-vert-fonce">
                  {i === 1 ? "Lancer une enquête" : "Créer un lien d'invitation"}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
