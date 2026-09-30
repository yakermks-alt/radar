import type { Solidite as Niveau } from "@/lib/analyse/regroupement";

// Pastille de solidité d'une opportunité : combien d'avis, sur combien d'applis.
const NIVEAUX: Record<Niveau, { libelle: string; classes: string; point: string }> = {
  fort: { libelle: "Signal fort", classes: "bg-vert-clair text-vert-texte", point: "bg-vert" },
  moyen: { libelle: "Signal moyen", classes: "bg-ambre-pale text-ambre-texte", point: "bg-ambre" },
  faible: { libelle: "Signal faible", classes: "bg-surface-2 text-doux", point: "bg-doux" },
};

export function Solidite({ niveau, nbAvis, nbApps }: { niveau: Niveau; nbAvis: number; nbApps: number }) {
  const n = NIVEAUX[niveau];
  return (
    <span title={`${nbAvis} avis sur ${nbApps} applis`} className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap ${n.classes}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${n.point}`} aria-hidden />
      {n.libelle}
    </span>
  );
}
