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
  {
    href: "/suivi",
    libelle: "Suivi des opportunités",
    actif: (p: string) => p.startsWith("/suivi"),
    icone: (
      <>
        <rect x="3" y="4" width="4" height="12" rx="1" />
        <rect x="8" y="4" width="4" height="8" rx="1" />
        <rect x="13" y="4" width="4" height="10" rx="1" />
      </>
    ),
  },
  {
    href: "/equipe",
    libelle: "Équipe",
    actif: (p: string) => p.startsWith("/equipe"),
    icone: (
      <>
        <circle cx="7.5" cy="7" r="2.8" />
        <path d="M2.5 16 C3 12.8 5 11.5 7.5 11.5 C10 11.5 12 12.8 12.5 16" />
        <path d="M13 4.8 C14.6 5.1 15.4 6.2 15.4 7.3 C15.4 8.5 14.6 9.5 13 9.8" />
        <path d="M14.5 11.8 C16.2 12.3 17.3 13.7 17.5 16" />
      </>
    ),
  },
];

const ADMIN = {
  href: "/admin",
  libelle: "Administration",
  actif: (p: string) => p.startsWith("/admin"),
  icone: (
    <>
      <path d="M10 2.5 L16 5 V9.5 C16 13 13.5 16 10 17.5 C6.5 16 4 13 4 9.5 V5 Z" />
      <path d="M7.5 10 L9.3 11.8 L12.8 8.3" />
    </>
  ),
};

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 26 26" fill="none" aria-hidden>
      <circle cx="13" cy="13" r="11" stroke="var(--color-menthe)" strokeWidth="2" />
      <circle cx="13" cy="13" r="4" fill="var(--color-menthe)" />
    </svg>
  );
}

// Colonne d'icônes vert nuit (barre horizontale sur téléphone). Charte : MASTER.md.
export type Personne = { initiale: string; admin: boolean } | null;

export function Rail({ personne }: { personne: Personne }) {
  const chemin = usePathname();
  const liens = personne ? (personne.admin ? [...LIENS, ADMIN] : LIENS) : [];
  return (
    <nav
      aria-label="Navigation principale"
      className="sans-impression sticky top-0 z-20 flex shrink-0 items-center gap-2 bg-nuit px-4 py-2 md:h-screen md:w-[72px] md:flex-col md:px-0 md:py-[18px]"
    >
      <Link href="/" aria-label="Radar, accueil" className="mr-2 flex h-10 w-10 items-center justify-center md:mr-0 md:mb-3.5">
        <Logo />
      </Link>
      {liens.map((l) => {
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
      {personne && (
        <Link
          href="/compte"
          aria-label="Mon compte"
          title="Mon compte"
          aria-current={chemin.startsWith("/compte") ? "page" : undefined}
          className="ml-auto flex h-11 w-11 items-center justify-center md:mt-auto md:ml-0"
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold transition-colors duration-150 ease-radar ${
              chemin.startsWith("/compte") ? "bg-menthe text-nuit" : "bg-nuit-3 text-white hover:bg-nuit-2"
            }`}
          >
            {personne.initiale}
          </span>
        </Link>
      )}
    </nav>
  );
}
