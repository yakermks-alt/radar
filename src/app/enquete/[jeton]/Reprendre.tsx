"use client";

import { useActionState } from "react";
import { reprendreEnquete, suivreEnquete } from "../../enquetes/actions";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE } from "../../_ui/styles";

export function Reprendre({ jeton }: { jeton: string }) {
  const [etat, action, enCours] = useActionState(reprendreEnquete.bind(null, jeton), { message: null });
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-3">
      <button type="submit" disabled={enCours} className={BOUTON_PRINCIPAL}>
        {enCours ? "Relance…" : "Reprendre l'enquête"}
      </button>
      <p aria-live="polite" className="text-sm text-rouge">
        {etat.message}
      </p>
    </form>
  );
}

// Ajoute l'enquête au tableau de suivi de l'équipe (en-tête du rapport).
export function Suivre({ jeton }: { jeton: string }) {
  const [etat, action, enCours] = useActionState(suivreEnquete.bind(null, jeton), { message: null });
  return (
    <form action={action} className="flex items-center gap-2">
      {etat.message && <span className="text-[13px] text-rouge">{etat.message}</span>}
      <button type="submit" disabled={enCours} className={BOUTON_SECONDAIRE}>
        {enCours ? "Ajout…" : "Ajouter au suivi"}
      </button>
    </form>
  );
}
