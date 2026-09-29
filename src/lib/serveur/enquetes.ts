import "server-only";
import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Rapport } from "../agent/agent";
import { baseServeur } from "./base";

export const ENQUETES_PAR_JOUR = 10; // quotas gratuits : ~1 000 recherches web/mois, ~500 appels Flash-Lite/jour
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
  cree_le: string;
  maj_le: string;
};

const JETON = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function enqueteParJeton(jeton: string): Promise<{ enquete: Enquete; etapes: EtapeAffichee[] } | null> {
  if (!JETON.test(jeton)) return null;
  const db = baseServeur();
  const { data: enquete, error } = await db
    .from("enquetes")
    .select("id, jeton, sujet, statut, budget, etapes_faites, rapport, erreur, cree_le, maj_le")
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
  return { enquete, etapes: etapes ?? [] };
}

export async function dernieresEnquetes(n = 20): Promise<Pick<Enquete, "jeton" | "sujet" | "statut" | "etapes_faites" | "budget" | "cree_le">[]> {
  const { data, error } = await baseServeur()
    .from("enquetes")
    .select("jeton, sujet, statut, etapes_faites, budget, cree_le")
    .order("cree_le", { ascending: false })
    .limit(n);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Enquêtes lancées depuis minuit (heure de Paris), toutes personnes confondues.
export async function enquetesDuJour(maintenant = new Date()): Promise<number> {
  const jour = maintenant.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }); // AAAA-MM-JJ
  const decalage = maintenant.toLocaleString("en-US", { timeZone: "Europe/Paris", timeZoneName: "longOffset" }).match(/GMT([+-]\d{2}:\d{2})/)?.[1] ?? "+00:00";
  const { count, error } = await baseServeur()
    .from("enquetes")
    .select("id", { count: "exact", head: true })
    .gte("cree_le", `${jour}T00:00:00${decalage}`);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function creerEnquete(sujet: string): Promise<{ id: number; jeton: string }> {
  const { data, error } = await baseServeur()
    .from("enquetes")
    .insert({ sujet, budget: BUDGET_ETAPES })
    .select("id, jeton")
    .single<{ id: number; jeton: string }>();
  if (error) throw new Error(error.message);
  return data;
}

// Efface l'erreur d'une enquête interrompue avant de relancer l'agent (la page repasse en direct).
export async function relancerEnquete(id: number): Promise<void> {
  const { error } = await baseServeur().from("enquetes").update({ erreur: null, maj_le: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
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
