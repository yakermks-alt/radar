// Cherche sur l'App Store France les applis utilisées par les professionnels, secteur par secteur,
// fait trier par Gemini Flash-Lite les vrais outils pro (et écarter les applis grand public),
// puis écrit la liste dans data/apps.json (relue avant d'être synchronisée en base).
// Lancer : npx tsx --env-file=.env.local scripts/collecte/lister-apps.mts
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { lireRecherche, pause, recupererJson, urlRecherche, type AppTrouvee } from "../../src/lib/collecte/appstore";
import { genererJson } from "../../src/lib/ia/gemini";

const SECTEURS: Record<string, string[]> = {
  "compta-facturation": ["facturation", "comptabilité", "devis facture", "note de frais"],
  "auto-entrepreneur": ["auto-entrepreneur", "micro-entreprise"],
  "banque-pro": ["compte pro", "banque entreprise"],
  "caisse-commerce": ["caisse enregistreuse", "terminal de paiement", "gestion de stock"],
  restauration: ["gestion restaurant", "logiciel restaurant", "commande restaurant"],
  "planning-rh": ["planning employés", "pointage salariés", "paie", "gestion RH"],
  "btp-artisans": ["artisan devis", "suivi de chantier", "intervention technicien", "plombier électricien"],
  "sante-liberal": ["infirmière libérale", "cabinet médical", "kinésithérapeute", "logiciel médecin"],
  immobilier: ["agent immobilier", "gestion locative", "syndic copropriété"],
  "beaute-bien-etre": ["salon de coiffure", "institut de beauté", "prise de rendez-vous pro", "agenda professionnel"],
  "transport-livraison": ["chauffeur VTC", "application livreur", "gestion de flotte", "transporteur"],
  agriculture: ["exploitation agricole", "agriculteur", "élevage gestion"],
  "education-enfance": ["crèche", "auto-école", "cahier de liaison", "assistante maternelle"],
  "sport-coaching": ["coach sportif", "salle de sport gestion", "club sportif"],
  "hotellerie-tourisme": ["gestion hôtel", "location saisonnière", "conciergerie airbnb"],
  "vente-crm": ["CRM", "prospection commerciale", "signature électronique"],
  associations: ["gestion association", "adhérents association"],
  "sante-liberal-2": ["dentiste cabinet", "orthophoniste", "psychologue agenda", "pharmacie officine", "ambulancier", "sage-femme"],
  "juridique-conseil": ["avocat cabinet", "notaire", "expert-comptable client", "architecte chantier"],
  "services-domicile": ["aide à domicile", "services à la personne", "auxiliaire de vie", "ménage entreprise"],
  "commerce-alimentaire": ["boulangerie", "traiteur", "food truck", "marché producteur", "fleuriste"],
  "artisans-2": ["paysagiste", "déménageur", "garage automobile", "carrossier", "serrurier"],
  "independants-creatifs": ["photographe professionnel", "formateur indépendant", "tatoueur", "vendeur en ligne"],
  "securite-proprete": ["agent de sécurité", "entreprise de nettoyage"],
  taxi: ["taxi chauffeur", "moto taxi"],
};

// Applis écartées à la main après relecture : jamais reproposées.
const EXCLUSIONS = new Set(Object.keys(JSON.parse(readFileSync(new URL("../../data/exclusions.json", import.meta.url), "utf8"))));

const NOTES_MIN = 30; // en dessous, trop peu d'avis pour dégager des tendances
const LOT_TRI = 40;

type Candidate = AppTrouvee & { secteur: string };
const trouvees = new Map<string, Candidate>();
for (const [secteur, termes] of Object.entries(SECTEURS)) {
  for (const terme of termes) {
    const json = await recupererJson(urlRecherche(terme));
    const apps = json ? lireRecherche(json) : [];
    let nouvelles = 0;
    for (const a of apps) {
      if (a.nbNotes < NOTES_MIN || trouvees.has(a.storeId) || EXCLUSIONS.has(a.storeId)) continue;
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

const liste = gardees
  .sort((a, b) => a.secteur.localeCompare(b.secteur) || b.nbNotes - a.nbNotes)
  .map((a) => {
    const { description, ...sansDescription } = a; // la description ne sert qu'au tri
    void description;
    return sansDescription;
  });
writeFileSync(new URL("../../data/apps.json", import.meta.url), JSON.stringify(liste, null, 2) + "\n");
console.log(`\n${liste.length} applis pro écrites dans data/apps.json (sur ${candidats.length} candidates)`);
