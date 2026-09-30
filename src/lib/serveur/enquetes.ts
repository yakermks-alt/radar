import "server-only";
import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Rapport } from "../agent/agent";
import type { Mesures } from "../agent/mesures";
import { ENQUETES_SITE_PAR_JOUR, OFFRES, type Plan } from "../offres";
import { baseServeur } from "./base";

export const BUDGET_ETAPES = 15;

export type EtapeAffichee = {
  numero: number;
  pensee: string | null;
  outil: string;
  argument: string | null;
  statut: "ok" | "erreur";
  resultat: string | null;
  cree_le: string;
};

export type Enquete = {
  id: number;
  jeton: string;
  sujet: string;
  statut: "en_attente" | "en_cours" | "terminee" | "echec";
  budget: number;
  etapes_faites: number;
  rapport: Rapport | null;
  erreur: string | null;
  mesures: Partial<Mesures>;
  reprises: number;
  equipe_id: number | null;
  cree_le: string;
  maj_le: string;
};

const JETON = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type SourceAffichee = { url: string; titre: string | null; suspecte: boolean };

export async function enqueteParJeton(jeton: string): Promise<{ enquete: Enquete; etapes: EtapeAffichee[]; sources: SourceAffichee[] } | null> {
  if (!JETON.test(jeton)) return null;
  const db = baseServeur();
  const { data: enquete, error } = await db
    .from("enquetes")
    .select("id, jeton, sujet, statut, budget, etapes_faites, rapport, erreur, mesures, reprises, equipe_id, cree_le, maj_le")
    .eq("jeton", jeton)
    .maybeSingle<Enquete>();
  if (error) throw new Error(error.message);
  if (!enquete) return null;
  const { data: etapes, error: e2 } = await db
    .from("etapes")
    .select("numero, pensee, outil, argument, statut, resultat, cree_le")
    .eq("enquete_id", enquete.id)
    .order("numero")
    .returns<EtapeAffichee[]>();
  if (e2) throw new Error(e2.message);
  const { data: sources, error: e3 } = await db
    .from("sources")
    .select("url, titre, suspecte")
    .eq("enquete_id", enquete.id)
    .order("id")
    .returns<SourceAffichee[]>();
  if (e3) throw new Error(e3.message);
  return { enquete, etapes: etapes ?? [], sources: sources ?? [] };
}

export type EnqueteListee = Pick<Enquete, "jeton" | "sujet" | "statut" | "etapes_faites" | "budget" | "cree_le" | "erreur"> & {
  verdict: string | null;
};

// Enquêtes d'une équipe (les enquêtes du banc de tests et celles d'avant les comptes n'en ont pas).
export async function dernieresEnquetes(equipe: number, n = 20): Promise<EnqueteListee[]> {
  const { data, error } = await baseServeur()
    .from("enquetes")
    .select("jeton, sujet, statut, etapes_faites, budget, cree_le, erreur, verdict:rapport->>verdict")
    .eq("equipe_id", equipe)
    .order("cree_le", { ascending: false })
    .limit(n);
  if (error) throw new Error(error.message);
  return (data ?? []) as EnqueteListee[];
}

const minuitParis = (maintenant: Date) => {
  const jour = maintenant.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }); // AAAA-MM-JJ
  const decalage = maintenant.toLocaleString("en-US", { timeZone: "Europe/Paris", timeZoneName: "longOffset" }).match(/GMT([+-]\d{2}:\d{2})/)?.[1] ?? "+00:00";
  return `${jour}T00:00:00${decalage}`;
};

// Ce qu'il reste à l'équipe : même calcul que reserver_enquete (qui reste seule juge au lancement).
export async function quotaEquipe(equipe: number, plan: Plan, maintenant = new Date()): Promise<{ restantes: number; periode: "semaine" | "jour" }> {
  const db = baseServeur();
  const semaine = new Date(maintenant.getTime() - 7 * 86_400_000).toISOString();
  const [s, j, site] = await Promise.all([
    db.from("enquetes").select("id", { count: "exact", head: true }).eq("equipe_id", equipe).gt("cree_le", semaine),
    db.from("enquetes").select("id", { count: "exact", head: true }).eq("equipe_id", equipe).gte("cree_le", minuitParis(maintenant)),
    enquetesDuJour(maintenant),
  ]);
  if (s.error || j.error) throw new Error((s.error ?? j.error)!.message);
  const offre = OFFRES[plan];
  const parSemaine = offre.enquetesSemaine - (s.count ?? 0);
  const parJour = offre.enquetesJour - (j.count ?? 0);
  const restantes = Math.max(0, Math.min(parSemaine, parJour, ENQUETES_SITE_PAR_JOUR - site));
  return { restantes, periode: plan === "gratuit" ? "semaine" : "jour" };
}

// Enquêtes lancées depuis minuit (heure de Paris), toutes personnes confondues.
export async function enquetesDuJour(maintenant = new Date()): Promise<number> {
  const { count, error } = await baseServeur()
    .from("enquetes")
    .select("id", { count: "exact", head: true })
    .is("banc", null)
    .gte("cree_le", minuitParis(maintenant));
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// Réserve l'enquête dans les quotas (équipe et site) en une seule opération atomique côté base.
// Refus : erreur dont le message contient le code (quota_semaine, quota_jour, limite_site).
export async function creerEnquete(sujet: string, equipe: number, utilisateur: string, plan: Plan): Promise<{ id: number; jeton: string }> {
  const offre = OFFRES[plan];
  const { data, error } = await baseServeur()
    .rpc("reserver_enquete", {
      p_equipe: equipe,
      p_utilisateur: utilisateur,
      p_sujet: sujet,
      p_budget: BUDGET_ETAPES,
      p_max_semaine: offre.enquetesSemaine,
      p_max_jour: offre.enquetesJour,
      p_max_site: ENQUETES_SITE_PAR_JOUR,
    })
    .single<{ id: number; jeton: string }>();
  if (error) throw new Error(error.message);
  return data;
}

// Efface l'erreur d'une enquête interrompue avant de relancer l'agent (la page repasse en direct).
export async function relancerEnquete(id: number): Promise<void> {
  const { error } = await baseServeur().from("enquetes").update({ erreur: null, maj_le: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

// Retire une enquête que l'agent n'a jamais pu commencer (lancement refusé par GitHub) : elle ne
// doit ni rester en attente pour toujours ni compter dans la limite du jour.
export async function annulerEnquete(id: number): Promise<void> {
  const { error } = await baseServeur().from("enquetes").delete().eq("id", id).eq("etapes_faites", 0);
  if (error) throw new Error(error.message);
}

// L'agent peut-il être lancé d'ici ? (vérifié avant d'enregistrer une enquête, pour ne pas en
// laisser une en attente pour toujours ni la compter dans la limite du jour)
export function agentLancable(): boolean {
  return Boolean(process.env.GITHUB_DISPATCH_TOKEN) || process.env.NODE_ENV === "development";
}

// Démarre l'agent sur une enquête. En ligne : tâche GitHub Actions (jeton GitHub limité à ce dépôt).
// En local (npm run dev) : processus détaché sur la machine, journal dans le dossier temporaire.
export async function lancerAgent(id: number): Promise<"github" | "local" | "aucun"> {
  const jeton = process.env.GITHUB_DISPATCH_TOKEN;
  const depot = process.env.GITHUB_DEPOT ?? "yakermks-alt/radar";
  if (jeton) {
    const res = await fetch(`https://api.github.com/repos/${depot}/actions/workflows/enquete.yml/dispatches`, {
      method: "POST",
      headers: { authorization: `Bearer ${jeton}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
      body: JSON.stringify({ ref: "main", inputs: { id: String(id) } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`GitHub ${res.status} : impossible de lancer l'agent`);
    return "github";
  }
  if (process.env.NODE_ENV === "development") {
    const journal = openSync(join(tmpdir(), `radar-enquete-${id}.log`), "a");
    spawn("npx", ["tsx", "--env-file=.env.local", "scripts/agent/enqueter.mts", "--reprendre", String(id)], {
      cwd: process.cwd(),
      detached: true,
      stdio: ["ignore", journal, journal],
    }).unref();
    return "local";
  }
  return "aucun";
}
