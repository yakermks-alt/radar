// Cherche sur l'App Store France les applis utilisées par les professionnels, secteur par secteur,
// fait trier par Gemini Flash-Lite les vrais outils pro (et écarter les applis grand public),
// puis écrit la liste dans data/apps.json (relue avant d'être synchronisée en base). Les applis déjà dans
// la liste sont gardées telles quelles : seules les nouvelles passent par le tri (quota Gemini).
// Lancer : npx tsx --env-file=.env.local scripts/collecte/lister-apps.mts
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { lireRecherche, pause, recupererJson, urlRecherche, type AppTrouvee } from "../../src/lib/collecte/appstore";
import { genererJson } from "../../src/lib/ia/gemini";

const SECTEURS: Record<string, string[]> = {
  "compta-facturation": ["facturation", "comptabilité", "devis facture", "note de frais", "logiciel comptable", "relance impayés", "encaissement client", "TVA déclaration"],
  "auto-entrepreneur": ["auto-entrepreneur", "micro-entreprise"],
  "banque-pro": ["compte pro", "banque entreprise"],
  "caisse-commerce": ["caisse enregistreuse", "terminal de paiement", "gestion de stock", "inventaire code barre", "boutique en ligne gestion", "fidélité client commerce", "click and collect commerçant", "prise de commande"],
  restauration: ["gestion restaurant", "logiciel restaurant", "commande restaurant", "réservation restaurant", "HACCP", "traçabilité alimentaire", "gestion bar"],
  "planning-rh": ["planning employés", "pointage salariés", "paie", "gestion RH", "gestion des congés", "recrutement", "intérim", "temps de travail"],
  "btp-artisans": ["artisan devis", "suivi de chantier", "intervention technicien", "plombier électricien", "BTP", "chauffagiste", "maintenance technicien", "métré chantier", "planning chantier"],
  "sante-liberal": ["infirmière libérale", "cabinet médical", "kinésithérapeute", "logiciel médecin", "ostéopathe", "podologue", "diététicien", "vétérinaire", "opticien", "télétransmission", "EHPAD soignant"],
  immobilier: ["agent immobilier", "gestion locative", "syndic copropriété", "état des lieux", "diagnostic immobilier", "propriétaire bailleur"],
  "beaute-bien-etre": ["salon de coiffure", "institut de beauté", "prise de rendez-vous pro", "agenda professionnel", "esthéticienne", "barbier", "onglerie", "spa massage"],
  "transport-livraison": ["chauffeur VTC", "application livreur", "gestion de flotte", "transporteur", "logistique entrepôt", "coursier", "poids lourd", "chronotachygraphe"],
  agriculture: ["exploitation agricole", "agriculteur", "élevage gestion", "viticulture", "maraîcher", "irrigation"],
  "education-enfance": ["crèche", "auto-école", "cahier de liaison", "assistante maternelle", "école de musique", "soutien scolaire", "formation professionnelle", "centre de loisirs"],
  "sport-coaching": ["coach sportif", "salle de sport gestion", "club sportif", "réservation terrain", "studio de yoga"],
  "hotellerie-tourisme": ["gestion hôtel", "location saisonnière", "conciergerie airbnb", "camping", "gîte chambre d'hôtes", "channel manager"],
  "vente-crm": ["CRM", "prospection commerciale", "signature électronique", "tournée commerciale", "catalogue produits commercial", "devis commercial"],
  associations: ["gestion association", "adhérents association", "bénévoles", "billetterie événement"],
  "sante-liberal-2": ["dentiste cabinet", "orthophoniste", "psychologue agenda", "pharmacie officine", "ambulancier", "sage-femme"],
  "juridique-conseil": ["avocat cabinet", "notaire", "expert-comptable client", "architecte chantier", "huissier", "géomètre", "courtier assurance"],
  "services-domicile": ["aide à domicile", "services à la personne", "auxiliaire de vie", "ménage entreprise", "jardinage entreprise", "garde d'enfants", "pressing"],
  "commerce-alimentaire": ["boulangerie", "traiteur", "food truck", "marché producteur", "fleuriste"],
  "artisans-2": ["paysagiste", "déménageur", "garage automobile", "carrossier", "serrurier", "contrôle technique", "location de véhicules", "imprimerie"],
  "independants-creatifs": ["photographe professionnel", "formateur indépendant", "tatoueur", "vendeur en ligne", "graphiste freelance", "traiteur événementiel", "location matériel événement"],
  "securite-proprete": ["agent de sécurité", "entreprise de nettoyage"],
  taxi: ["taxi chauffeur", "moto taxi"],
  "autres-metiers": ["pompes funèbres", "agence de voyage", "sécurité incendie", "maintenance ascenseur", "blanchisserie"],
};

// Applis écartées à la main après relecture : jamais reproposées.
const EXCLUSIONS = new Set(Object.keys(JSON.parse(readFileSync(new URL("../../data/exclusions.json", import.meta.url), "utf8"))));

const NOTES_MIN = 30; // en dessous, trop peu d'avis pour dégager des tendances
const LOT_TRI = 40;
const PAR_RECHERCHE = 50; // 25 jusqu'au 30/09 : trop peu de matière (médiane de 12 avis par opportunité du Top 20)

type Connue = AppTrouvee & { secteur: string };
const CHEMIN_LISTE = new URL("../../data/apps.json", import.meta.url);
const connues: Connue[] = JSON.parse(readFileSync(CHEMIN_LISTE, "utf8"));
const dejaListees = new Set(connues.map((a) => a.storeId));

type Candidate = AppTrouvee & { secteur: string };
const trouvees = new Map<string, Candidate>();
for (const [secteur, termes] of Object.entries(SECTEURS)) {
  for (const terme of termes) {
    const json = await recupererJson(urlRecherche(terme, PAR_RECHERCHE));
    const apps = json ? lireRecherche(json) : [];
    let nouvelles = 0;
    for (const a of apps) {
      if (a.nbNotes < NOTES_MIN || trouvees.has(a.storeId) || EXCLUSIONS.has(a.storeId) || dejaListees.has(a.storeId)) continue;
      trouvees.set(a.storeId, { ...a, secteur });
      nouvelles++;
    }
    console.log(`${secteur.padEnd(20)} « ${terme} » : ${apps.length} résultats, ${nouvelles} nouvelles`);
    await pause(3_500); // ~17 requêtes/min, sous la limite d'Apple
  }
}

const tri = z.object({
  applis: z.array(
    z.object({
      storeId: z.string(),
      pro: z.boolean(),
      secteur: z.string(),
    }),
  ),
});

const SYSTEME = `Tu tries des applications de l'App Store France.
Une appli est "pro" si ses utilisateurs principaux sont des professionnels qui s'en servent pour leur travail
(indépendants, TPE, PME, soignants libéraux, artisans, commerçants, gérants, salariés dans leur métier)
ET qu'ils paient ou pourraient payer pour elle (logiciel métier, SaaS, banque pro, outil de gestion).
Pas "pro" : applis grand public (commande de repas pour particuliers, banque perso, jeux, réseaux sociaux,
applis d'une seule enseigne pour ses clients, applis d'employeur réservées à ses salariés).
Pas "pro" non plus, car leurs plaintes ne révèlent aucun besoin de niche : outils bureautiques ou de
communication généralistes des grands groupes tech (Microsoft, Google, Adobe, Zoom, Apple, Meta, Dropbox),
assistants IA généralistes, authentificateurs, gestionnaires de mots de passe, clients SSH, VPN,
lecteurs PDF, médias, magazines et sites d'annonces.
Pour chaque appli, garde le secteur proposé s'il convient, sinon choisis le plus juste parmi : ${Object.keys(SECTEURS).join(", ")}.`;

const candidats = [...trouvees.values()];
const gardees: Candidate[] = [];
for (let i = 0; i < candidats.length; i += LOT_TRI) {
  const lot = candidats.slice(i, i + LOT_TRI);
  const r = await genererJson({
    systeme: SYSTEME,
    prompt: JSON.stringify(
      lot.map((a) => ({ storeId: a.storeId, nom: a.nom, editeur: a.editeur, genre: a.genre, secteur: a.secteur, description: a.description })),
    ),
    schema: tri,
  });
  const verdicts = new Map(r.applis.map((v) => [v.storeId, v]));
  for (const a of lot) {
    const v = verdicts.get(a.storeId);
    if (v?.pro) gardees.push({ ...a, secteur: v.secteur in SECTEURS ? v.secteur : a.secteur });
  }
  console.log(`Tri ${Math.min(i + LOT_TRI, candidats.length)}/${candidats.length} : ${gardees.length} applis pro`);
}

const liste = [
  ...connues,
  ...gardees.map((a) => {
    const { description, ...sansDescription } = a; // la description ne sert qu'au tri
    void description;
    return sansDescription;
  }),
]
  .sort((a, b) => a.secteur.localeCompare(b.secteur) || b.nbNotes - a.nbNotes);
writeFileSync(CHEMIN_LISTE, JSON.stringify(liste, null, 2) + "\n");
console.log(`\n${liste.length} applis pro dans data/apps.json : ${connues.length} déjà connues + ${gardees.length} nouvelles (sur ${candidats.length} candidates)`);
