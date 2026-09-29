// Lance ou reprend une enquête de l'agent (moteur : moteur.ts).
// Nouvelle enquête : npx tsx --env-file=.env.local scripts/agent/enqueter.mts "logiciels pour boulangeries" [--budget 15]
// Reprendre       : npx tsx --env-file=.env.local scripts/agent/enqueter.mts --reprendre 12
// File d'attente  : npx tsx --env-file=.env.local scripts/agent/enqueter.mts --file
//                   (reprise automatique des enquêtes interrompues ou oubliées ; tâche GitHub horaire)
import { db, verifier } from "../lib/base";
import { mener, nettoyerCache, prendre, prendreOubliee } from "./moteur";

const arg = (nom: string) => {
  const i = process.argv.indexOf(nom);
  return i > 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  if (!process.env.TAVILY_API_KEY) console.log("(pas de clé Tavily : l'agent enquête sans recherche web)");
  if (process.argv.includes("--file")) {
    await nettoyerCache().catch(() => undefined);
    let n = 0;
    for (let id = await prendreOubliee(); id !== null; id = await prendreOubliee()) {
      await mener(id);
      n++;
    }
    console.log(n ? `${n} enquête(s) traitée(s).` : "Aucune enquête à reprendre.");
    return;
  }
  const reprise = arg("--reprendre");
  let id: number;
  if (reprise) id = Number(reprise);
  else {
    const sujet = process.argv.slice(2).find((x, i, t) => !x.startsWith("--") && t[i - 1] !== "--budget");
    if (!sujet) throw new Error('Sujet manquant : enqueter.mts "logiciels pour boulangeries"');
    const budget = Number(arg("--budget") ?? 15);
    const e: { id: number } = await verifier(db.from("enquetes").insert({ sujet, budget }).select("id").single());
    id = e.id;
  }
  if ((await prendre(id)) === null) throw new Error(`Enquête ${id} introuvable, terminée ou déjà en cours ailleurs`);
  await mener(id);
}

await main();
