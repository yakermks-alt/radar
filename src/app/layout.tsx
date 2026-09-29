import type { Metadata } from "next";
import { Onest } from "next/font/google";
import "./globals.css";
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
        <Rail />
        <div className="flex min-w-0 flex-1 flex-col md:flex-row">{children}</div>
      </body>
    </html>
  );
}
