"use client";

import { BOUTON_SOMBRE } from "../../_ui/styles";

// « Télécharger le rapport » : la boîte d'impression du navigateur propose « Enregistrer en PDF ».
// La feuille de style d'impression retire la navigation (classe sans-impression).
export function Imprimer() {
  return (
    <button type="button" className={BOUTON_SOMBRE} onClick={() => window.print()}>
      Télécharger le rapport
    </button>
  );
}
