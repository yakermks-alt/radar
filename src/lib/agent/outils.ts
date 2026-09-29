// Sources externes de l'agent : recherche web (Tavily, offre gratuite de 1 000 recherches/mois)
// et fiches d'entreprises (API Recherche d'entreprises de l'État, gratuite et sans clé).
import { z } from "zod";

export type Resultat = { titre: string; url: string; extrait: string };

const tavily = z.object({
  results: z.array(z.object({ title: z.string().nullish(), url: z.string(), content: z.string().nullish() })),
});

export async function rechercherWeb(requete: string, cle: string | undefined, f: typeof fetch = fetch): Promise<Resultat[]> {
  if (!cle) throw new Error("Recherche web indisponible (TAVILY_API_KEY manquante)");
  const res = await f("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cle}` },
    body: JSON.stringify({ query: requete, max_results: 6, search_depth: "basic", include_answer: false }),
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 429 || res.status === 432) throw new Error("Quota de recherche web épuisé");
  if (!res.ok) throw new Error(`Recherche web ${res.status}`);
  return tavily
    .parse(await res.json())
    .results.filter((r) => /^https?:\/\//.test(r.url))
    .map((r) => ({ titre: (r.title ?? r.url).slice(0, 300), url: r.url, extrait: (r.content ?? "").slice(0, 1500) }));
}

// Effectifs : codes Insee des tranches.
const TRANCHES: Record<string, string> = {
  NN: "non renseigné", "00": "0 salarié", "01": "1 ou 2 salariés", "02": "3 à 5 salariés", "03": "6 à 9 salariés",
  "11": "10 à 19 salariés", "12": "20 à 49 salariés", "21": "50 à 99 salariés", "22": "100 à 199 salariés",
  "31": "200 à 249 salariés", "32": "250 à 499 salariés", "41": "500 à 999 salariés", "42": "1 000 à 1 999 salariés",
  "51": "2 000 à 4 999 salariés", "52": "5 000 à 9 999 salariés", "53": "10 000 salariés et plus",
};

const entreprise = z.object({
  siren: z.string(),
  nom_complet: z.string().nullish(),
  activite_principale: z.string().nullish(),
  date_creation: z.string().nullish(),
  tranche_effectif_salarie: z.string().nullish(),
  categorie_entreprise: z.string().nullish(),
  nombre_etablissements_ouverts: z.number().nullish(),
  finances: z.record(z.string(), z.object({ ca: z.number().nullish(), resultat_net: z.number().nullish() })).nullish(),
  complements: z.object({ est_entrepreneur_individuel: z.boolean().nullish() }).nullish(),
});

export type FicheEntreprise = { url: string; titre: string; texte: string };

const euros = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

// Fiches des sociétés trouvées. Les entrepreneurs individuels sont écartés : leur nom est
// une donnée personnelle et ce ne sont pas les concurrents recherchés (éditeurs de logiciels).
export async function chercherEntreprises(recherche: string, f: typeof fetch = fetch): Promise<FicheEntreprise[]> {
  const url = `https://recherche-entreprises.api.gouv.fr/search?${new URLSearchParams({ q: recherche, per_page: "5", etat_administratif: "A" })}`;
  const res = await f(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Recherche d'entreprises ${res.status}`);
  const { results } = z.object({ results: z.array(z.unknown()) }).parse(await res.json());
  return results
    .map((r) => entreprise.safeParse(r))
    .flatMap((r) => (r.success && !r.data.complements?.est_entrepreneur_individuel ? [r.data] : []))
    .map((e) => {
      const nom = e.nom_complet ?? e.siren;
      const annees = Object.keys(e.finances ?? {}).sort();
      const derniere = annees.at(-1);
      const fin = derniere ? e.finances?.[derniere] : undefined;
      const lignes = [
        `${nom} (SIREN ${e.siren})`,
        e.date_creation && `Créée le ${e.date_creation}`,
        e.activite_principale && `Code NAF ${e.activite_principale}`,
        `Effectif : ${TRANCHES[e.tranche_effectif_salarie ?? "NN"] ?? "non renseigné"}`,
        e.categorie_entreprise && `Catégorie : ${e.categorie_entreprise}`,
        e.nombre_etablissements_ouverts != null && `${e.nombre_etablissements_ouverts} établissement(s) ouvert(s)`,
        fin?.ca != null && `Chiffre d'affaires ${derniere} : ${euros(fin.ca)}`,
        fin?.resultat_net != null && `Résultat net ${derniere} : ${euros(fin.resultat_net)}`,
      ].filter(Boolean);
      return { url: `https://annuaire-entreprises.data.gouv.fr/entreprise/${e.siren}`, titre: nom.slice(0, 300), texte: lignes.join(". ") + "." };
    });
}
