"use client";

import { useActionState } from "react";
import { lancerEnquete, type EtatFormulaire } from "./actions";

export function Formulaire({ sujetInitial, codeDemande }: { sujetInitial: string; codeDemande: boolean }) {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(lancerEnquete, { message: null, sujet: sujetInitial });

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="sujet" className="text-sm font-medium">
        Sur quoi enquêter ?
      </label>
      <textarea
        id="sujet"
        name="sujet"
        required
        minLength={10}
        maxLength={200}
        rows={2}
        defaultValue={etat.sujet}
        placeholder="Ex. : logiciel de caisse simple pour boulangeries"
        className="w-full resize-none rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-100"
      />
      {codeDemande && (
        <>
          <label htmlFor="code" className="text-sm font-medium">
            Code d&apos;accès
          </label>
          <input
            id="code"
            name="code"
            type="password"
            required
            autoComplete="off"
            className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-100 sm:w-64"
          />
        </>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={enCours}
          className="rounded-lg bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {enCours ? "Lancement…" : "Lancer l'enquête"}
        </button>
        <p aria-live="polite" className="text-sm text-red-600 dark:text-red-400">
          {etat.message}
        </p>
      </div>
    </form>
  );
}
