import Link from "next/link";
import type { ReactNode } from "react";

// Barre blanche du haut de page : chemin à gauche, actions à droite (choix de Maksen, en-tête B).
export function BarreHaut({ chemin, actions }: { chemin: { libelle: string; href?: string }[]; actions?: ReactNode }) {
  return (
    <header className="sans-impression flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-bordure bg-surface px-4 py-2 md:px-7">
      <nav aria-label="Fil d'Ariane" className="min-w-0 truncate text-[13px] text-doux">
        {chemin.map((c, i) => (
          <span key={i}>
            {i > 0 && <span className="mx-2">/</span>}
            {c.href ? (
              <Link href={c.href} className="text-doux no-underline hover:text-texte">
                {c.libelle}
              </Link>
            ) : (
              <span className="font-semibold text-texte">{c.libelle}</span>
            )}
          </span>
        ))}
      </nav>
      {actions && <div className="flex gap-2">{actions}</div>}
    </header>
  );
}
