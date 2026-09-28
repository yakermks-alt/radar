// Tri par l'IA des avis de 1 à 3 étoiles pas encore analysés (applis actives seulement).
// S'arrête proprement si le quota Gemini du jour est épuisé : le reste passera la nuit suivante.
// Lancer : npx tsx --env-file=.env.local scripts/analyse/trier-avis.mts [--max-lots N]
import { TAILLE_LOT, trierLot, type AvisATrier } from "../../src/lib/analyse/extraction";
import { pause } from "../../src/lib/collecte/appstore";
import { QuotaEpuise } from "../../src/lib/ia/gemini";
import { avecJournal, db, verifier } from "../lib/base";

const maxLots = Number(process.argv[process.argv.indexOf("--max-lots") + 1]) || Infinity;
// Gemini gratuit met souvent 1 à 2 min par lot : on en traite plusieurs en parallèle,
// en restant sous la limite de 15 requêtes/min de Flash-Lite.
const EN_PARALLELE = 5;
const PAUSE_MS = 4_500;

type Ligne = { id: number; note: number; titre: string | null; contenu: string; apps: { nom: string; secteur: string } };

await avecJournal(
  "analyse",
  async (bilan) => {
    const traiter = async (lot: AvisATrier[]) => {
      const verdicts = await trierLot(lot);
      // Un avis sans verdict (oubli de l'IA) est marqué "autre" pour ne pas bloquer la file.
      const trouves = new Set(verdicts.map((v) => v.id));
      const oublis = lot
        .filter((a) => !trouves.has(a.id))
        .map((a) => ({ id: a.id, categorie: "autre", probleme: null, type_client: null, gravite: 1, signal_paiement: false }));
      const n = await verifier(db.rpc("enregistrer_analyses", { lignes: [...verdicts, ...oublis] }));
      bilan.avis += n;
      bilan.oublis += oublis.length;
      for (const v of verdicts) bilan.categories[v.categorie] = (bilan.categories[v.categorie] ?? 0) + 1;
    };

    for (let lots = 0; lots < maxLots && !bilan.quotaEpuise; ) {
      // Toujours les premiers avis restants : ceux traités sortent de la sélection.
      const lignes = (await verifier(
        db
          .from("avis")
          .select("id, note, titre, contenu, apps!inner(nom, secteur)")
          .is("analyse_le", null)
          .lte("note", 3)
          .eq("apps.active", true)
          .order("id")
          .limit(TAILLE_LOT * Math.min(EN_PARALLELE, maxLots - lots)),
      )) as unknown as Ligne[];
      if (lignes.length === 0) break;

      const tous: AvisATrier[] = lignes.map((l) => ({ id: l.id, app: l.apps.nom, secteur: l.apps.secteur, note: l.note, titre: l.titre, contenu: l.contenu }));
      const paquets: AvisATrier[][] = [];
      for (let i = 0; i < tous.length; i += TAILLE_LOT) paquets.push(tous.slice(i, i + TAILLE_LOT));

      const resultats = await Promise.allSettled(
        paquets.map(async (p, i) => {
          await pause(i * PAUSE_MS); // départs étalés
          await traiter(p);
        }),
      );
      for (const r of resultats) {
        if (r.status === "fulfilled") continue;
        if (r.reason instanceof QuotaEpuise) bilan.quotaEpuise = true;
        else throw r.reason;
      }
      lots += paquets.length;
      console.log(`${lots} lots, ${bilan.avis} avis triés`);
    }
    console.log(`\nBilan : ${bilan.avis} avis triés`, bilan.categories, bilan.quotaEpuise ? "(quota du jour atteint)" : "");
    return "ok";
  },
  { avis: 0, oublis: 0, quotaEpuise: false, categories: {} as Record<string, number> },
);
