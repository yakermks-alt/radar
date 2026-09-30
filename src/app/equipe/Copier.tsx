"use client";

import { useState } from "react";

// Lien d'invitation en lecture seule, avec un bouton pour le copier.
export function Copier({ texte }: { texte: string }) {
  const [copie, setCopie] = useState(false);
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <input readOnly value={texte} aria-label="Lien d'invitation" onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-[6px] border border-bordure bg-surface px-2.5 py-1.5 font-mono text-xs" />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(texte);
          setCopie(true);
          setTimeout(() => setCopie(false), 2000);
        }}
        className="shrink-0 rounded-bouton border border-bordure bg-surface px-2.5 py-1.5 text-[13px] font-semibold transition-colors duration-150 ease-radar hover:bg-surface-2"
      >
        {copie ? "Copié" : "Copier"}
      </button>
    </span>
  );
}
