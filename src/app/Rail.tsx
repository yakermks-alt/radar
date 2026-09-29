"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LIENS = [
  {
    href: "/",
    libelle: "Opportunités",
    actif: (p: string) => p === "/",
    icone: (
      <>
        <path d="M3 15 L8 9 L11 12 L17 5" />
        <path d="M13 5 H17 V9" />
      </>
    ),
  },
  {
    href: "/enquetes",
    libelle: "Enquêtes",
    actif: (p: string) => p.startsWith("/enquete"),
    icone: (
      <>
        <circle cx="9" cy="9" r="5.5" />
        <path d="M13 13 L17 17" />
      </>
    ),
  },
];

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 26 26" fill="none" aria-hidden>
      <circle cx="13" cy="13" r="11" stroke="var(--color-menthe)" strokeWidth="2" />
      <circle cx="13" cy="13" r="4" fill="var(--color-menthe)" />
    </svg>
  );
}

// Colonne d'icônes vert nuit (barre horizontale sur téléphone). Charte : MASTER.md.
export function Rail() {
  const chemin = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="sans-impression sticky top-0 z-20 flex shrink-0 items-center gap-2 bg-nuit px-4 py-2 md:h-screen md:w-[72px] md:flex-col md:px-0 md:py-[18px]"
    >
      <Link href="/" aria-label="Radar, accueil" className="mr-2 flex h-10 w-10 items-center justify-center md:mr-0 md:mb-3.5">
        <Logo />
      </Link>
      {LIENS.map((l) => {
        const actif = l.actif(chemin);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-label={l.libelle}
            title={l.libelle}
            aria-current={actif ? "page" : undefined}
            className={`flex h-11 w-11 items-center justify-center rounded-bouton transition-colors duration-150 ease-radar ${
              actif ? "bg-nuit-2 shadow-[inset_3px_0_0_var(--color-menthe)]" : "hover:bg-nuit-2"
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={actif ? "#ffffff" : "var(--color-rail)"} strokeWidth="1.6" aria-hidden>
              {l.icone}
            </svg>
          </Link>
        );
      })}
    </nav>
  );
}
