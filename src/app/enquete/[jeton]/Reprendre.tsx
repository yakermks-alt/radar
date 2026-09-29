"use client";

import { useActionState } from "react";
import { reprendreEnquete } from "../../enquetes/actions";
import { BOUTON_PRINCIPAL, CHAMP } from "../../_ui/styles";

export function Reprendre({ jeton, codeDemande }: { jeton: string; codeDemande: boolean }) {
  const [etat, action, enCours] = useActionState(reprendreEnquete.bind(null, jeton), { message: null });
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-3">
      {codeDemande && <input name="code" type="password" required autoComplete="off" aria-label="Code d'accès" placeholder="Code d'accès" className={`${CHAMP} max-w-52 py-2 text-sm`} />}
      <button type="submit" disabled={enCours} className={BOUTON_PRINCIPAL}>
        {enCours ? "Relance…" : "Reprendre l'enquête"}
      </button>
      <p aria-live="polite" className="text-sm text-rouge">
        {etat.message}
      </p>
    </form>
  );
}
