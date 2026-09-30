import "server-only";
import { baseServeur } from "./base";

// Tableau de bord de l'administrateur : lecture seule, jamais affiché sans contrôle du rôle admin.

export type VueAdmin = {
  utilisateurs: { id: string; email: string; nom: string | null; admin: boolean; equipe: string | null; plan: string | null; vu_le: string; cree_le: string }[];
  equipes: { total: number; pro: number };
  enquetes: { jour: number; semaine: number; parStatut: Record<string, number>; echecs: { jeton: string; sujet: string; erreur: string | null; maj_le: string }[] };
  quotas: { recherchesMois: number; enquetesJour: number };
  journal: { tache: string; statut: string; demarre_le: string; erreur: string | null }[];
  emails: { jour: string; envoyes: number; refuses: number } | null;
};

export async function vueAdmin(): Promise<VueAdmin> {
  const db = baseServeur();
  const maintenant = Date.now();
  const jour = new Date(maintenant - 86_400_000).toISOString();
  const semaine = new Date(maintenant - 7 * 86_400_000).toISOString();
  const [profils, equipes, pro, recentes, echecs, recherches, journal, emails] = await Promise.all([
    db
      .from("profils")
      .select("id, email, nom, admin, vu_le, cree_le, equipes!profils_equipe_active_fkey(nom, plan)")
      .order("vu_le", { ascending: false })
      .limit(100)
      .returns<{ id: string; email: string; nom: string | null; admin: boolean; vu_le: string; cree_le: string; equipes: { nom: string; plan: string } | null }[]>(),
    db.from("equipes").select("id", { count: "exact", head: true }),
    db.from("equipes").select("id", { count: "exact", head: true }).eq("plan", "pro"),
    db.from("enquetes").select("statut, cree_le").is("banc", null).gte("cree_le", semaine).returns<{ statut: string; cree_le: string }[]>(),
    db
      .from("enquetes")
      .select("jeton, sujet, erreur, maj_le")
      .is("banc", null)
      .or("statut.eq.echec,erreur.not.is.null")
      .order("maj_le", { ascending: false })
      .limit(8)
      .returns<VueAdmin["enquetes"]["echecs"]>(),
    db.rpc("recherches_du_mois"),
    db.from("journal").select("tache, statut, demarre_le, erreur").order("demarre_le", { ascending: false }).limit(8).returns<VueAdmin["journal"]>(),
    db.from("emails_matin").select("jour, statut").order("jour", { ascending: false }).limit(200).returns<{ jour: string; statut: string }[]>(),
  ]);
  for (const r of [profils, equipes, pro, recentes, echecs, recherches, journal, emails]) if (r.error) throw new Error(r.error.message);

  const parStatut: Record<string, number> = {};
  for (const e of recentes.data ?? []) parStatut[e.statut] = (parStatut[e.statut] ?? 0) + 1;
  const dernierJour = emails.data?.[0]?.jour ?? null;
  const duJour = (emails.data ?? []).filter((e) => e.jour === dernierJour);

  return {
    utilisateurs: (profils.data ?? []).map(({ equipes: e, ...p }) => ({ ...p, equipe: e?.nom ?? null, plan: e?.plan ?? null })),
    equipes: { total: equipes.count ?? 0, pro: pro.count ?? 0 },
    enquetes: {
      jour: (recentes.data ?? []).filter((e) => e.cree_le >= jour).length,
      semaine: recentes.data?.length ?? 0,
      parStatut,
      echecs: echecs.data ?? [],
    },
    quotas: { recherchesMois: Number(recherches.data ?? 0), enquetesJour: (recentes.data ?? []).filter((e) => e.cree_le >= jour).length },
    journal: journal.data ?? [],
    emails: dernierJour ? { jour: dernierJour, envoyes: duJour.filter((e) => e.statut === "envoye").length, refuses: duJour.filter((e) => e.statut === "refuse").length } : null,
  };
}
