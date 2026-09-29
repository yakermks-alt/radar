// « Métier : besoin » (nom d'un groupe du Top 20) devient un sujet d'enquête lisible.
export function versSujet(nom: string): string {
  const [metier, besoin] = nom.split(/\s*:\s*/, 2);
  if (!besoin) return nom;
  const phrase = `${besoin} pour les ${metier.toLowerCase()}`;
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

const SECTEURS: Record<string, string> = {
  "compta-facturation": "Compta et facturation",
  "vente-crm": "Vente et CRM",
  "services-domicile": "Services à domicile",
  "caisse-commerce": "Caisse et commerce",
  "sport-coaching": "Sport et coaching",
  "sante-liberal": "Santé libérale",
  "planning-rh": "Planning et RH",
  transversal: "Transversal",
};

export function libelleSecteur(cle: string | null): string {
  if (!cle) return "Autre";
  cle = cle.replace(/-\d+$/, ""); // « sante-liberal-2 » : variante d'un même secteur
  const connu = SECTEURS[cle];
  if (connu) return connu;
  const brut = cle.replace(/-/g, " et ");
  return brut.charAt(0).toUpperCase() + brut.slice(1);
}
