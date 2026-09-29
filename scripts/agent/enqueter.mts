// Lance ou reprend une enquête de l'agent. Chaque étape est enregistrée en base avant la suivante :
// une coupure (quota, réseau, machine éteinte) ne perd rien, on reprend là où on s'est arrêté.
// Nouvelle enquête : npx tsx --env-file=.env.local scripts/agent/enqueter.mts "logiciels pour boulangeries" [--budget 15]
// Reprendre       : npx tsx --env-file=.env.local scripts/agent/enqueter.mts --reprendre 12
// File d'attente  : npx tsx --env-file=.env.local scripts/agent/enqueter.mts --file  (toutes les enquêtes en attente)
import { annoncer } from "../../src/lib/agent/annonce";
import { avancer, decision, jugement, rapportBrut, type AvisProche, type Dependances, type Etat } from "../../src/lib/agent/agent";
import { chercherEntreprises, rechercherWeb } from "../../src/lib/agent/outils";
import { lirePage } from "../../src/lib/agent/page";
import { vectoriser, versPgvector } from "../../src/lib/analyse/embeddings";
import { creerCompteur } from "../../src/lib/marche/sirene";
import { genererJson, MODELES_REDACTION, ModeleIndisponible, QuotaEpuise } from "../../src/lib/ia/gemini";
import { db, sansErreur, toutLire, verifier } from "../lib/base";

const arg = (nom: string) => {
  const i = process.argv.indexOf(nom);
  return i > 0 ? process.argv[i + 1] : undefined;
};

const deps: Dependances = {
  // Délais courts : une enquête se regarde en direct, mieux vaut réessayer ou changer de modèle qu'attendre.
  decider: (systeme, prompt) => genererJson({ systeme, prompt, schema: decision, delaiMs: 90_000, essais: 3 }),
  // Le meilleur modèle disponible pour la rédaction : on passe au suivant s'il est saturé ou à court de quota.
  rediger: async (systeme, prompt) => {
    for (const [i, modele] of MODELES_REDACTION.entries()) {
      try {
        return await genererJson({ modele, systeme, prompt, schema: rapportBrut, delaiMs: 120_000, essais: 2 });
      } catch (e) {
        if (!(e instanceof QuotaEpuise || e instanceof ModeleIndisponible) || i === MODELES_REDACTION.length - 1) throw e;
        console.log(`  (${modele} ${e instanceof QuotaEpuise ? "à court de quota" : "saturé"} : rédaction avec ${MODELES_REDACTION[i + 1]})`);
      }
    }
    throw new Error("Aucun modèle de rédaction");
  },
  juger: (systeme, prompt) => genererJson({ systeme, prompt, schema: jugement, delaiMs: 90_000, essais: 3 }),
  rechercher: process.env.TAVILY_API_KEY ? (requete) => rechercherWeb(requete, process.env.TAVILY_API_KEY) : undefined,
  lire: (url) => lirePage(url),
  avis: async (texte) => {
    const [v] = await vectoriser([texte]);
    const lignes: { id: number; note: number; contenu: string; app: string; secteur: string; similarite: number }[] =
      await verifier(db.rpc("avis_proches", { vecteur: versPgvector(v), n: 8 }));
    return lignes satisfies AvisProche[];
  },
  entreprises: (recherche) => chercherEntreprises(recherche),
  compterNaf: process.env.INSEE_API_KEY ? creerCompteur(process.env.INSEE_API_KEY) : undefined,
};

async function charger(id: number): Promise<Etat & { jeton: string }> {
  const e: { sujet: string; budget: number; jeton: string } = await verifier(db.from("enquetes").select("sujet, budget, jeton").eq("id", id).single());
  const etapes: Etat["etapes"] = await verifier(
    db.from("etapes").select("numero, pensee, outil, argument, statut, resultat, observation").eq("enquete_id", id).order("numero"),
  );
  const sources: Etat["sources"] = await toutLire((a, b) =>
    db.from("sources").select("url, titre, texte, suspecte").eq("enquete_id", id).order("id").range(a, b),
  );
  return { sujet: e.sujet, budget: e.budget, jeton: e.jeton, etapes, sources };
}

const liberer = (id: number) => sansErreur(db.from("enquetes").update({ verrou_jusqu_a: null }).eq("id", id));

// Mène une enquête déjà verrouillée jusqu'au rapport, ou jusqu'à un arrêt (quota, erreur).
async function mener(id: number): Promise<void> {
  let etat = await charger(id);
  console.log(`\nEnquête ${id} : « ${etat.sujet} » (étape ${etat.etapes.length + 1} sur ${etat.budget})`);
  for (;;) {
    let a;
    try {
      a = await avancer(etat, deps);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await sansErreur(db.from("enquetes").update({ erreur: msg.slice(0, 500), maj_le: new Date().toISOString() }).eq("id", id));
      await liberer(id);
      await annoncer(etat.jeton, "arret");
      console.log(e instanceof QuotaEpuise ? `Arrêt : ${msg}. Reprise possible demain (--reprendre ${id}).` : `Arrêt sur erreur : ${msg}`);
      process.exitCode = 1;
      return;
    }
    const { etape, sources, rapport } = a;
    await sansErreur(db.rpc("enregistrer_etape", { enquete: id, etape, sources }));
    if (!rapport) await annoncer(etat.jeton, "etape");
    console.log(`${String(etape.numero).padStart(2)}. ${etape.outil}${etape.argument ? `(${etape.argument})` : ""} → ${etape.statut === "ok" ? "" : "ÉCHEC : "}${etape.resultat}`);
    if (etape.pensee) console.log(`    ${etape.pensee}`);
    if (rapport) {
      await sansErreur(
        db.from("enquetes").update({ statut: "terminee", rapport, erreur: null, verrou_jusqu_a: null, maj_le: new Date().toISOString() }).eq("id", id),
      );
      await annoncer(etat.jeton, "fin");
      afficher(rapport);
      return;
    }
    etat = { ...etat, etapes: [...etat.etapes, etape], sources: fusionner(etat.sources, sources) };
  }
}

function fusionner(anciennes: Etat["sources"], nouvelles: Etat["sources"]): Etat["sources"] {
  const parUrl = new Map(anciennes.map((s) => [s.url, s]));
  for (const s of nouvelles) parUrl.set(s.url, s);
  return [...parUrl.values()];
}

function afficher(r: NonNullable<Awaited<ReturnType<typeof avancer>>["rapport"]>) {
  console.log(`\n=== Rapport : ${r.verdict} ===`);
  for (const s of r.sections) {
    console.log(`\n## ${s.titre}`);
    if (!s.affirmations.length) console.log("  (aucune preuve trouvée)");
    for (const x of s.affirmations) console.log(`  - ${x.texte}\n    « ${x.citation} » (${x.source})`);
  }
  console.log(`\n${r.rejetees.length} affirmation(s) rejetée(s) faute de citation vérifiable${r.rejetees.length ? " :" : "."}`);
  for (const x of r.rejetees) console.log(`  - [${x.raison}] ${x.texte}`);
}

async function prendre(cible: number | null): Promise<number | null> {
  const lignes: { id: number }[] = await verifier(db.rpc("prendre_enquete", { cible }));
  return lignes[0]?.id ?? null;
}

async function main() {
  if (process.argv.includes("--file")) {
    for (let id = await prendre(null); id !== null; id = await prendre(null)) await mener(id);
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
  if (!process.env.TAVILY_API_KEY) console.log("(pas de clé Tavily : l'agent enquête sans recherche web)");
  await mener(id);
}

await main();
