"use client";

import { useActionState } from "react";
import { reprendreEnquete } from "../../enquetes/actions";

export function Reprendre({ jeton, codeDemande }: { jeton: string; codeDemande: boolean }) {
  const [etat, action, enCours] = useActionState(reprendreEnquete.bind(null, jeton), { message: null });
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-3">
      {codeDemande && (
        <input
          name="code"
          type="password"
          required
          autoComplete="off"
          aria-label="Code d'accès"
          placeholder="Code d'accès"
          className="w-48 rounded-lg border border-neutral-300 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-100"
        />
      )}
      <button type="submit" disabled={enCours} className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
        {enCours ? "Relance…" : "Reprendre l'enquête"}
      </button>
      <p aria-live="polite" className="text-sm text-red-600 dark:text-red-400">
        {etat.message}
      </p>
    </form>
  );
}
