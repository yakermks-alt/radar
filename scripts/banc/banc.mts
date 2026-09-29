// Banc de tests de l'agent (phase 5) : enquêtes de référence menées de bout en bout, puis évaluées
// indépendamment de la chaîne de rédaction (citations revérifiées, chiffres, relecture par un
// autre modèle). Résultat : le taux d'invention, à comparer au seuil de 5 %.
// Lancer  : npx tsx --env-file=.env.local scripts/banc/banc.mts [--taille 20] [--budget 12]
// Évaluer : npx tsx --env-file=.env.local scripts/banc/banc.mts --evaluer <nom>   (réévalue un passage, ex. quand Flash est libre)
// Bilan   : npx tsx --env-file=.env.local scripts/banc/banc.mts --bilan <nom>     (écrit docs/banc/<nom>.md, sans IA)
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { jugement, type Rapport } from "../../src/lib/agent/agent";
import { affirmationsGardees, bilan, evaluerRapport, promptEvaluation, SEUIL_INVENTION, SYSTEME_EVALUATION } from "../../src/lib/agent/evaluation";
import type { Evaluation, Mesures } from "../../src/lib/agent/mesures";
import { genererJson, MODELES_REDACTION, ModeleIndisponible, QuotaEpuise } from "../../src/lib/ia/gemini";
import { db, sansErreur, toutLire, verifier } from "../lib/base";
import { mener, prendre } from "../agent/moteur";

const RACINE = join(import.meta.dirname, "../..");
const arg = (nom: string) => {
  const i = process.argv.indexOf(nom);
  return i > 0 ? process.argv[i + 1] : undefined;
};

type Ligne = { id: number; jeton: string; sujet: string; statut: string; etapes_faites: number; rapport: Rapport | null; mesures: Partial<Mesures>; erreur: string | null };

const enquetesDuBanc = (nom: string): Promise<Ligne[]> =>
  verifier(db.from("enquetes").select("id, jeton, sujet, statut, etapes_faites, rapport, mesures, erreur").eq("banc", nom).order("id"));

async function lancer(nom: string, taille: number, budget: number) {
  const sujets: string[] = JSON.parse(readFileSync(join(RACINE, "docs/banc-sujets.json"), "utf8"));
  console.log(`Banc « ${nom} » : ${Math.min(taille, sujets.length)} enquêtes, ${budget} étapes au plus chacune`);
  for (const sujet of sujets.slice(0, taille)) {
    const { id }: { id: number } = await verifier(db.from("enquetes").insert({ sujet, budget, banc: nom }).select("id").single());
    if ((await prendre(id)) === null) continue;
    const debut = Date.now();
    const issue = await mener(id, false);
    console.log(`- ${sujet} : ${issue} en ${Math.round((Date.now() - debut) / 1000)} s`);
    if (issue === "arret") {
      const { erreur }: { erreur: string | null } = await verifier(db.from("enquetes").select("erreur").eq("id", id).single());
      if (/quota/i.test(erreur ?? "")) {
        console.log("Quota Gemini du jour épuisé : les enquêtes restantes ne sont pas lancées (celle-ci reprendra toute seule).");
        break;
      }
    }
  }
}

// Relecture par le meilleur modèle disponible (autre que celui de la chaîne quand c'est possible).
async function relire(rapport: Rapport): Promise<{ verdicts: { numero: number; prouve: boolean }[] | null; juge: string | null }> {
  const gardees = affirmationsGardees(rapport);
  if (!gardees.length) return { verdicts: [], juge: "aucune affirmation" };
  for (const modele of MODELES_REDACTION) {
    try {
      const r = await genererJson({ modele, systeme: SYSTEME_EVALUATION, prompt: promptEvaluation(gardees), schema: jugement, delaiMs: 120_000, essais: 2 });
      return { verdicts: r.verdicts, juge: modele };
    } catch (e) {
      if (!(e instanceof QuotaEpuise || e instanceof ModeleIndisponible)) throw e;
    }
  }
  return { verdicts: null, juge: null };
}

async function evaluer(nom: string) {
  for (const e of await enquetesDuBanc(nom)) {
    if (e.statut !== "terminee" || !e.rapport) continue;
    const sources: { url: string; texte: string }[] = await toutLire((a, b) => db.from("sources").select("url, texte").eq("enquete_id", e.id).range(a, b));
    const { verdicts, juge } = await relire(e.rapport);
    const evaluation = evaluerRapport(e.rapport, new Map(sources.map((s) => [s.url, s.texte])), verdicts, juge);
    await sansErreur(db.from("enquetes").update({ mesures: { ...e.mesures, evaluation } }).eq("id", e.id));
    console.log(`- ${e.sujet} : ${evaluation.inventions}/${evaluation.gardees} fautive(s) (relu par ${juge ?? "personne"})`);
  }
}

const pct = (x: number | null) => (x === null ? "n.d." : `${(x * 100).toFixed(1).replace(".", ",")} %`);

function resume(nom: string, lignes: Ligne[]): string {
  const evals = lignes.map((l) => l.mesures.evaluation ?? null);
  const b = bilan(evals, lignes.length);
  const appels = lignes.reduce((s, l) => s + Object.values(l.mesures.appels_ia ?? {}).reduce((x, n) => x + n, 0), 0);
  const recherches = lignes.reduce((s, l) => s + (l.mesures.recherches ?? 0), 0);
  const cache = lignes.reduce((s, l) => s + (l.mesures.recherches_cache ?? 0) + (l.mesures.pages_cache ?? 0), 0);
  const durees = lignes.map((l) => l.mesures.duree_s ?? 0).filter((d) => d > 0);
  const verdict = b.taux_invention === null ? "pas encore mesuré" : b.taux_invention <= SEUIL_INVENTION ? "objectif atteint" : "objectif NON atteint";
  const somme = (f: (e: Evaluation) => number) => evals.reduce((s, e) => s + (e ? f(e) : 0), 0);
  return [
    `# Banc de tests « ${nom} »`,
    "",
    `**Taux d'invention : ${pct(b.taux_invention)}** (${b.inventions} affirmations fautives sur ${b.gardees} gardées ; objectif ≤ ${pct(SEUIL_INVENTION)} : ${verdict}).`,
    "",
    `- Enquêtes : ${b.terminees} terminées et évaluées sur ${b.enquetes} ; ${b.relues_par_ia} relues par un modèle IA`,
    `- Détail des fautes : ${somme((e) => e.citations_absentes)} citation(s) absente(s) de la source, ${somme((e) => e.chiffres_non_prouves)} chiffre(s) non prouvé(s), ${somme((e) => e.non_prouvees_juge)} affirmation(s) jugée(s) non prouvée(s) par le relecteur`,
    `- Sections remplies : ${b.sections_couvertes_moyenne?.toFixed(1).replace(".", ",") ?? "n.d."} sur 5 en moyenne ; ${(b.gardees / Math.max(1, b.terminees)).toFixed(1).replace(".", ",")} affirmations par rapport`,
    `- Consommation : ${appels} appels à l'IA, ${recherches} recherches web, ${cache} lectures servies par le cache ; durée médiane ${durees.length ? Math.round(durees.sort((x, y) => x - y)[Math.floor(durees.length / 2)]) : "n.d."} s`,
    "",
    "| Enquête | Statut | Gardées | Fautives | Sections | Relecteur | Durée |",
    "|---|---|---|---|---|---|---|",
    ...lignes.map((l) => {
      const e = l.mesures.evaluation;
      return `| ${l.sujet} | ${l.statut}${l.erreur ? ` (${l.erreur.slice(0, 40)})` : ""} | ${e?.gardees ?? "-"} | ${e?.inventions ?? "-"} | ${e?.sections_couvertes ?? "-"}/5 | ${e?.juge ?? "-"} | ${l.mesures.duree_s ? `${Math.round(l.mesures.duree_s)} s` : "-"} |`;
    }),
    "",
  ].join("\n");
}

async function main() {
  const aEvaluer = arg("--evaluer");
  const aResumer = arg("--bilan");
  let nom: string;
  if (aResumer) nom = aResumer;
  else if (aEvaluer) nom = aEvaluer;
  else {
    nom = `banc-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-")}`;
    await lancer(nom, Number(arg("--taille") ?? 20), Number(arg("--budget") ?? 12));
  }
  if (!aResumer) await evaluer(nom);

  const texte = resume(nom, await enquetesDuBanc(nom));
  console.log(`\n${texte}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, texte);
  if (aResumer) {
    mkdirSync(join(RACINE, "docs/banc"), { recursive: true });
    writeFileSync(join(RACINE, `docs/banc/${nom}.md`), texte);
    console.log(`Écrit : docs/banc/${nom}.md`);
  }
}

await main();
