import type { NextConfig } from "next";

// En-têtes de sécurité (mise en ligne du 29/09), posés ici et pas dans netlify.toml : avec le
// runtime Next.js de Netlify, les pages sont servies par une fonction que netlify.toml ne couvre pas.
// connect-src limité au seul projet Supabase (temps réel des enquêtes) : un script hostile ne
// pourrait rien envoyer ailleurs. Pas d'iframe (clickjacking), HTTPS forcé.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL manquant : la CSP a besoin de l'adresse du projet Supabase");
const SUPABASE = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host;
const DEV = process.env.NODE_ENV === "development";

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `connect-src 'self' https://${SUPABASE} wss://${SUPABASE}${DEV ? " ws://localhost:*" : ""}`,
  "img-src 'self' data:",
  "font-src 'self'",
  `script-src 'self' 'unsafe-inline'${DEV ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
].join("; ");

const entetes = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: entetes }];
  },
};

export default nextConfig;
