import type { Metadata } from "next";
import { Onest } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { contexte } from "@/lib/serveur/session";
import { Rail } from "./Rail";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Radar",
  description: "Opportunités business trouvées dans les vraies plaintes des clients, vérifiées par un agent enquêteur.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${onest.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col md:flex-row">
        <Suspense fallback={<Rail personne={null} />}>
          <RailConnecte />
        </Suspense>
        <div className="flex min-w-0 flex-1 flex-col md:flex-row">{children}</div>
      </body>
    </html>
  );
}

// La colonne d'icônes dépend de la personne connectée (lien Administration, initiale du compte).
async function RailConnecte() {
  const c = await contexte();
  const nom = c?.utilisateur.nom ?? c?.utilisateur.email ?? "";
  return <Rail personne={c ? { initiale: nom.trim().charAt(0).toUpperCase() || "?", admin: c.utilisateur.admin } : null} />;
}
