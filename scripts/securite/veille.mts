// Veille quotidienne des anomalies (checklist sécurité du 29/09), dans la tâche GitHub du matin.
// En cas d'anomalie, la tâche échoue exprès : GitHub envoie alors un email au propriétaire du dépôt.
// Lancer : npx tsx --env-file=.env.local scripts/securite/veille.mts
import { ENQUETES_SITE_PAR_JOUR } from "../../src/lib/offres";
import { db } from "../lib/base";

const RECHERCHES_MOIS = 900; // plafond de l'agent, sous les 1 000 recherches gratuites de Tavily
const hier = new Date(Date.now() - 86_400_000).toISOString();
const compter = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
};

const [inscriptions, admins, echecs, enquetes, erreursNuit, refusStripe] = await Promise.all([
  compter(db.from("profils").select("id", { count: "exact", head: true }).gte("cree_le", hier)),
  compter(db.from("profils").select("id", { count: "exact", head: true }).eq("admin", true)),
  compter(db.from("enquetes").select("id", { count: "exact", head: true }).is("banc", null).eq("statut", "echec").gte("maj_le", hier)),
  compter(db.from("enquetes").select("id", { count: "exact", head: true }).is("banc", null).gte("cree_le", hier)),
  compter(db.from("journal").select("id", { count: "exact", head: true }).eq("statut", "erreur").gte("demarre_le", hier)),
  compter(db.from("equipes").select("id", { count: "exact", head: true }).eq("abonnement_statut", "past_due")),
]);
const { data: recherches, error } = await db.rpc("recherches_du_mois");
if (error) throw new Error(error.message);

const anomalies = [
  inscriptions > 20 && `${inscriptions} comptes créés en 24 h (rafale d'inscriptions ?)`,
  admins !== 1 && `${admins} administrateurs au lieu d'un seul`,
  echecs >= 3 && `${echecs} enquêtes en échec en 24 h`,
  enquetes >= ENQUETES_SITE_PAR_JOUR && `limite du site atteinte : ${enquetes} enquêtes en 24 h`,
  Number(recherches) >= RECHERCHES_MOIS * 0.8 && `${recherches} recherches web ce mois-ci sur ${RECHERCHES_MOIS}`,
  erreursNuit > 0 && `${erreursNuit} tâche(s) de nuit en erreur (collecte, analyse ou regroupement)`,
  refusStripe > 0 && `${refusStripe} abonnement(s) en défaut de paiement`,
].filter((a): a is string => Boolean(a));

console.log(`Veille : ${inscriptions} inscriptions, ${enquetes} enquêtes, ${echecs} échecs, ${recherches}/${RECHERCHES_MOIS} recherches, ${erreursNuit} erreurs de nuit, ${admins} admin.`);
if (anomalies.length) {
  console.error(`\nAnomalies :\n- ${anomalies.join("\n- ")}\n(détail : page Administration de Radar)`);
  process.exitCode = 1;
} else console.log("Rien d'anormal.");
