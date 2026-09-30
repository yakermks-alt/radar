"use client";

import { useActionState, useState } from "react";
import { BOUTON_PRINCIPAL, CARTE, CHAMP } from "../_ui/styles";
import { lancerEnquete, type EtatFormulaire } from "./actions";

export function Formulaire({ sujetInitial, idees, restantes, periode }: { sujetInitial: string; idees: string[]; restantes: number; periode: "semaine" | "jour" }) {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(lancerEnquete, { message: null, sujet: sujetInitial });
  const [sujet, setSujet] = useState(sujetInitial);

  return (
    <form action={action} className={`${CARTE} flex flex-col gap-[18px] p-5 md:p-6`}>
      <label className="flex flex-col gap-2 font-semibold">
        Sujet de l&apos;enquête
        <textarea
          name="sujet"
          required
          minLength={10}
          maxLength={200}
          rows={3}
          value={sujet}
          onChange={(e) => setSujet(e.target.value)}
          placeholder="Ex. : logiciel de caisse simple pour boulangeries"
          className={`${CHAMP} resize-none font-normal`}
        />
      </label>

      {idees.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] text-doux">Idées tirées du classement</span>
          <div className="flex flex-wrap gap-2">
            {idees.map((idee) => (
              <button
                key={idee}
                type="button"
                onClick={() => setSujet(idee)}
                className="rounded-full border border-bordure bg-surface px-3 py-1.5 text-[13px] text-texte-2 transition-colors duration-150 ease-radar hover:border-vert hover:bg-vert-clair hover:text-vert-fonce"
              >
                {idee}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-trait pt-[18px]">
        <span className="text-[13px] text-doux">
          Environ 1 minute · {restantes} enquête{restantes > 1 ? "s" : ""} restante{restantes > 1 ? "s" : ""} {periode === "semaine" ? "cette semaine" : "aujourd'hui"}
        </span>
        <button type="submit" disabled={enCours || restantes <= 0} className={`${BOUTON_PRINCIPAL} px-5 py-3 text-[15px]`}>
          {enCours ? "Lancement…" : "Lancer l'enquête"}
        </button>
      </div>
      <p aria-live="polite" className="-mt-2 text-sm text-rouge empty:hidden">
        {etat.message}
      </p>
    </form>
  );
}
