// Moteur de l'agent, partagé par les enquêtes (enqueter.mts) et le banc de tests (banc/banc.mts).
// Chaque étape est enregistrée en base avant la suivante : une coupure (quota, réseau, machine
// éteinte) ne perd rien. Phase 5 : mesures de chaque enquête, cache des recherches et des pages,
// plafond mensuel des recherches web, reprises automatiques limitées.
import { z } from "zod";
import { annoncer } from "../../src/lib/agent/annonce";
import { avancer, decision, jugement, rapportBrut, type AvisProche, type Dependances, type Etat, type Rapport } from "../../src/lib/agent/agent";
import { avecCache, clePage, cleRecherche, type Magasin } from "../../src/lib/agent/cache";
import { additionner, mesuresVides, PLAFOND_RECHERCHES_MOIS, prochaineRemiseQuota, REPRISES_MAX, type Mesures } from "../../src/lib/agent/mesures";
import { chercherEntreprises, rechercherWeb } from "../../src/lib/agent/outils";
import { lirePage } from "../../src/lib/agent/page";
import { vectoriser, versPgvector } from "../../src/lib/analyse/embeddings";
import { genererJson, MODELES, MODELES_REDACTION, ModeleIndisponible, QuotaEpuise } from "../../src/lib/ia/gemini";
import { creerCompteur } from "../../src/lib/marche/sirene";
import { db, sansErreur, toutLire, verifier } from "../lib/base";

const resultatsWeb = z.array(z.object({ titre: z.string(), url: z.string(), extrait: z.string() }));
const pageLue = z.object({ url: z.string(), titre: z.string().nullable(), texte: z.string(), suspecte: z.boolean() });

const magasin: Magasin = {
  lire: async (cle) => {
    const { data, error } = await db.from("cache_web").select("contenu, cree_le").eq("cle", cle).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },
  ecrire: async (cle, contenu) => sansErreur(db.from("cache_web").upsert({ cle, contenu, cree_le: new Date().toISOString() })),
};

const compter = (m: Mesures, modele: string) => {
  m.appels_ia[modele] = (m.appels_ia[modele] ?? 0) + 1;
};

// Dépendances de l'agent pour un passage, chaque appel compté dans les mesures.
async function creerDeps(m: Mesures): Promise<Dependances> {
  const cle = process.env.TAVILY_API_KEY;
  let rechercher: Dependances["rechercher"];
  if (cle) {
    const faites: number = await verifier(db.rpc("recherches_du_mois")).catch(() => 0);
    if (faites >= PLAFOND_RECHERCHES_MOIS) console.log(`(plafond de ${PLAFOND_RECHERCHES_MOIS} recherches web ce mois-ci atteint : enquête sans recherche web)`);
    else
      rechercher = async (requete) => {
        const r = await avecCache(magasin, cleRecherche(requete), resultatsWeb, async () => {
          m.recherches++;
          return rechercherWeb(requete, cle);
        });
        if (r.depuisCache) m.recherches_cache++;
        return r.valeur;
      };
  }

  return {
    // Délais courts : une enquête se regarde en direct, mieux vaut réessayer ou changer de modèle qu'attendre.
    decider: (systeme, prompt) => {
      compter(m, MODELES.leger);
      return genererJson({ systeme, prompt, schema: decision, delaiMs: 90_000, essais: 3 });
    },
    // Le meilleur modèle disponible pour la rédaction : on passe au suivant s'il est saturé ou à court de quota.
    rediger: async (systeme, prompt) => {
      for (const [i, modele] of MODELES_REDACTION.entries()) {
        try {
          compter(m, modele);
          return await genererJson({ modele, systeme, prompt, schema: rapportBrut, delaiMs: 120_000, essais: 2 });
        } catch (e) {
          if (!(e instanceof QuotaEpuise || e instanceof ModeleIndisponible) || i === MODELES_REDACTION.length - 1) throw e;
          console.log(`  (${modele} ${e instanceof QuotaEpuise ? "à court de quota" : "saturé"} : rédaction avec ${MODELES_REDACTION[i + 1]})`);
        }
      }
      throw new Error("Aucun modèle de rédaction");
    },
    juger: (systeme, prompt) => {
      compter(m, MODELES.leger);
      return genererJson({ systeme, prompt, schema: jugement, delaiMs: 90_000, essais: 3 });
    },
    rechercher,
    lire: async (url) => {
      const r = await avecCache(magasin, clePage(url), pageLue, async () => {
        m.pages++;
        return lirePage(url);
      });
      if (r.depuisCache) m.pages_cache++;
      return r.valeur;
    },
    avis: async (texte) => {
      const [v] = await vectoriser([texte]);
      const lignes: AvisProche[] = await verifier(db.rpc("avis_proches", { vecteur: versPgvector(v), n: 8 }));
      return lignes;
    },
    entreprises: (recherche) => chercherEntreprises(recherche),
    compterNaf: process.env.INSEE_API_KEY ? creerCompteur(process.env.INSEE_API_KEY) : undefined,
  };
}

type Enquete = Etat & { jeton: string; erreur: string | null; reprises: number; mesures: Partial<Mesures> };

async function charger(id: number): Promise<Enquete> {
  const e: { sujet: string; budget: number; jeton: string; erreur: string | null; reprises: number; mesures: Partial<Mesures> } = await verifier(
    db.from("enquetes").select("sujet, budget, jeton, erreur, reprises, mesures").eq("id", id).single(),
  );
  const etapes: Etat["etapes"] = await verifier(
    db.from("etapes").select("numero, pensee, outil, argument, statut, resultat, observation").eq("enquete_id", id).order("numero"),
  );
  const sources: Etat["sources"] = await toutLire((a, b) =>
    db.from("sources").select("url, titre, texte, suspecte").eq("enquete_id", id).order("id").range(a, b),
  );
  return { ...e, etapes, sources };
}

async function enregistrerMesures(id: number, m: Mesures, debut: number) {
  const { mesures }: { mesures: Partial<Mesures> } = await verifier(db.from("enquetes").select("mesures").eq("id", id).single());
  const total = additionner(mesures, { ...m, duree_s: (Date.now() - debut) / 1000 });
  await sansErreur(db.from("enquetes").update({ mesures: total }).eq("id", id));
}

export type Issue = "terminee" | "arret" | "echec";

// Mène une enquête déjà verrouillée jusqu'au rapport, ou jusqu'à un arrêt (quota, erreur).
export async function mener(id: number, bavard = true): Promise<Issue> {
  const debut = Date.now();
  const m = mesuresVides();
  let etat = await charger(id);
  const jeton = etat.jeton;

  // Reprise après une interruption : comptée, et abandonnée au-delà de REPRISES_MAX.
  if (etat.erreur !== null) {
    if (etat.reprises >= REPRISES_MAX) {
      await sansErreur(db.from("enquetes").update({ statut: "echec", verrou_jusqu_a: null, maj_le: new Date().toISOString() }).eq("id", id));
      await annoncer(jeton, "arret");
      console.log(`Enquête ${id} abandonnée après ${REPRISES_MAX} reprises (${etat.erreur})`);
      return "echec";
    }
    await sansErreur(db.from("enquetes").update({ reprises: etat.reprises + 1, erreur: null }).eq("id", id));
  }

  const deps = await creerDeps(m);
  if (bavard) console.log(`\nEnquête ${id} : « ${etat.sujet} » (étape ${etat.etapes.length + 1} sur ${etat.budget})`);
  for (;;) {
    let a;
    try {
      a = await avancer(etat, deps);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Quota du jour épuisé : rien ne sert de réessayer avant sa remise à zéro. Sinon, 30 min.
      const reprise = e instanceof QuotaEpuise ? prochaineRemiseQuota(new Date()) : new Date(Date.now() + 30 * 60_000);
      await sansErreur(
        db.from("enquetes").update({ erreur: msg.slice(0, 500), verrou_jusqu_a: reprise.toISOString(), maj_le: new Date().toISOString() }).eq("id", id),
      );
      await enregistrerMesures(id, m, debut);
      await annoncer(jeton, "arret");
      console.log(`Arrêt : ${msg}. Reprise automatique après ${reprise.toISOString()}.`);
      process.exitCode = 1;
      return "arret";
    }
    const { etape, sources, rapport } = a;
    await sansErreur(db.rpc("enregistrer_etape", { enquete: id, etape, sources }));
    if (etape.statut === "erreur") m.etapes_ratees++;
    if (!rapport) await annoncer(jeton, "etape");
    if (bavard) {
      console.log(`${String(etape.numero).padStart(2)}. ${etape.outil}${etape.argument ? `(${etape.argument})` : ""} → ${etape.statut === "ok" ? "" : "ÉCHEC : "}${etape.resultat}`);
      if (etape.pensee) console.log(`    ${etape.pensee}`);
    }
    if (rapport) {
      await sansErreur(
        db.from("enquetes").update({ statut: "terminee", rapport, erreur: null, verrou_jusqu_a: null, maj_le: new Date().toISOString() }).eq("id", id),
      );
      await enregistrerMesures(id, m, debut);
      await annoncer(jeton, "fin");
      if (bavard) afficher(rapport);
      return "terminee";
    }
    etat = { ...etat, etapes: [...etat.etapes, etape], sources: fusionner(etat.sources, sources) };
  }
}

function fusionner(anciennes: Etat["sources"], nouvelles: Etat["sources"]): Etat["sources"] {
  const parUrl = new Map(anciennes.map((s) => [s.url, s]));
  for (const s of nouvelles) parUrl.set(s.url, s);
  return [...parUrl.values()];
}

export function afficher(r: Rapport) {
  console.log(`\n=== Rapport : ${r.verdict} ===`);
  for (const s of r.sections) {
    console.log(`\n## ${s.titre}`);
    if (!s.affirmations.length) console.log("  (aucune preuve trouvée)");
    for (const x of s.affirmations) console.log(`  - ${x.texte}\n    « ${x.citation} » (${x.source})`);
  }
  console.log(`\n${r.rejetees.length} affirmation(s) rejetée(s) faute de preuve${r.rejetees.length ? " :" : "."}`);
  for (const x of r.rejetees) console.log(`  - [${x.raison}] ${x.texte}`);
}

export async function prendre(cible: number | null): Promise<number | null> {
  const lignes: { id: number }[] = await verifier(db.rpc("prendre_enquete", { cible }));
  return lignes[0]?.id ?? null;
}

// Enquête oubliée (interrompue, ou sans nouvelles depuis 15 min) à reprendre automatiquement.
export async function prendreOubliee(): Promise<number | null> {
  const lignes: { id: number }[] = await verifier(db.rpc("prendre_enquete_oubliee"));
  return lignes[0]?.id ?? null;
}

// Le cache ne garde rien au-delà de 8 jours (7 jours de validité + marge).
export async function nettoyerCache(): Promise<void> {
  await db.from("cache_web").delete().lt("cree_le", new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString());
}
