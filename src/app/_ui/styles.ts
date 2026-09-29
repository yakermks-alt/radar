// Classes des composants de base (charte : MASTER.md). Survol = fond seulement, jamais d'agrandissement.
const base =
  "inline-flex items-center justify-center gap-2 rounded-bouton px-4 py-2.5 text-sm font-semibold transition-colors duration-150 ease-radar disabled:cursor-not-allowed disabled:opacity-50";

export const BOUTON_PRINCIPAL = `${base} bg-vert text-white hover:bg-vert-fonce active:bg-[#064a33]`;
export const BOUTON_SOMBRE = `${base} bg-nuit text-white hover:bg-nuit-2 active:bg-nuit-3`;
export const BOUTON_SECONDAIRE = `${base} border border-bordure bg-surface text-texte hover:bg-surface-2 active:bg-trait`;

export const CARTE = "rounded-carte bg-surface shadow-carte";
export const CHAMP =
  "w-full rounded-bouton border border-bordure bg-surface px-3.5 py-3 text-[15px] text-texte transition-[border-color,box-shadow] duration-150 ease-radar placeholder:text-doux focus:border-vert focus:shadow-focus focus:outline-none";

export type Ton = { libelle: string; point: string; texte: string; fond: string; carte: string; carteTexte: string; carteDoux: string };

export const TONS: Record<"prometteur" | "a_creuser" | "decevant" | "en_cours" | "interrompue" | "echec", Ton> = {
  prometteur: { libelle: "Prometteur", point: "bg-vert", texte: "text-vert-texte", fond: "bg-vert-clair", carte: "bg-vert", carteTexte: "text-white", carteDoux: "text-sur-vert" },
  a_creuser: { libelle: "À creuser", point: "bg-ambre", texte: "text-ambre-texte", fond: "bg-ambre-pale", carte: "bg-ambre-pale", carteTexte: "text-ambre-texte", carteDoux: "text-ambre-texte" },
  decevant: { libelle: "Décevant", point: "bg-rouge", texte: "text-rouge", fond: "bg-rouge-pale", carte: "bg-rouge-pale", carteTexte: "text-rouge", carteDoux: "text-rouge" },
  en_cours: { libelle: "En cours", point: "bg-vert animate-pouls", texte: "text-vert-texte", fond: "bg-vert-clair", carte: "bg-vert-clair", carteTexte: "text-vert-texte", carteDoux: "text-vert-texte" },
  interrompue: { libelle: "Interrompue", point: "bg-ambre", texte: "text-ambre-texte", fond: "bg-ambre-pale", carte: "bg-ambre-pale", carteTexte: "text-ambre-texte", carteDoux: "text-ambre-texte" },
  echec: { libelle: "Échec", point: "bg-rouge", texte: "text-rouge", fond: "bg-rouge-pale", carte: "bg-rouge-pale", carteTexte: "text-rouge", carteDoux: "text-rouge" },
};

// Ton d'une enquête d'après son statut et son verdict.
export function tonEnquete(e: { statut: string; erreur: string | null; verdict?: string | null }): Ton {
  if (e.statut === "terminee" && e.verdict && e.verdict in TONS) return TONS[e.verdict as keyof typeof TONS];
  if (e.statut === "echec") return TONS.echec;
  if (e.erreur) return TONS.interrompue;
  return TONS.en_cours;
}

export const dateCourte = (iso: string) => {
  const jour = new Date(iso);
  const aujourdhui = new Date();
  const memeJour = (a: Date, b: Date) => a.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) === b.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
  if (memeJour(jour, aujourdhui)) return "aujourd'hui";
  if (memeJour(jour, new Date(aujourdhui.getTime() - 86_400_000))) return "hier";
  return jour.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
};
