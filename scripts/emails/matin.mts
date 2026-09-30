// Email du matin : 3 opportunités par personne inscrite (tâche GitHub .github/workflows/matin.yml).
// Envoi par Resend. Sans domaine vérifié (choix du 30/09 : mode démo), Resend n'accepte que l'adresse
// du compte Resend : les autres envois sont refusés et notés « refuse » dans la base, sans bloquer.
// Lancer : npx tsx --env-file=.env.local scripts/emails/matin.mts [--essai]
// --essai : affiche ce qui partirait, sans rien envoyer ni enregistrer.
import { z } from "zod";
import { choisir, composer, type OpportuniteEmail } from "../../src/lib/emails/matin";
import { pause } from "../../src/lib/collecte/appstore";
import { db, sansErreur, verifier } from "../lib/base";

const ESSAI = process.argv.includes("--essai");
if (!ESSAI && !process.env.RESEND_API_KEY) {
  console.log("RESEND_API_KEY absente : Resend pas encore branché, rien envoyé.");
  process.exit(0);
}
const env = z
  .object({
    RESEND_API_KEY: ESSAI ? z.string().optional() : z.string().startsWith("re_"),
    SITE_URL: z.url().default("https://radar-opportunites.netlify.app"),
    EMAIL_EXPEDITEUR: z.string().default("Radar <onboarding@resend.dev>"),
  })
  .parse(process.env);

const maintenant = new Date();
const jour = maintenant.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
const il_y_a_14_jours = new Date(maintenant.getTime() - 14 * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });

type Groupe = { nom: string; resume: string | null; secteur: string | null; score: number; contexte: { marche?: { total: number } | null } | null };
const groupes: Groupe[] = await verifier(db.from("groupes").select("nom, resume, secteur, score, contexte").order("score", { ascending: false }).limit(80));
const classement: OpportuniteEmail[] = groupes.map((g, i) => ({ rang: i + 1, nom: g.nom, resume: g.resume, secteur: g.secteur, score: Number(g.score), entreprises: g.contexte?.marche?.total ?? null }));
if (!classement.length) {
  console.log("Aucun classement calculé : rien à envoyer.");
  process.exit(0);
}

type Profil = { id: string; email: string; nom: string | null; secteurs: string[]; equipes: { plan: "gratuit" | "pro" } | null };
const profils: Profil[] = await verifier(
  db.from("profils").select("id, email, nom, secteurs, equipes!profils_equipe_active_fkey(plan)").eq("email_matin", true).limit(1000).returns<Profil[]>(),
);
const envois: { utilisateur_id: string; jour: string; opportunites: string[] }[] = await verifier(
  db.from("emails_matin").select("utilisateur_id, jour, opportunites").gte("jour", il_y_a_14_jours),
);

let envoyes = 0;
let refuses = 0;
for (const p of profils) {
  if (envois.some((e) => e.utilisateur_id === p.id && e.jour === jour)) continue; // déjà traité aujourd'hui (relance de la tâche)
  const dejaRecues = new Set(envois.filter((e) => e.utilisateur_id === p.id).flatMap((e) => e.opportunites));
  const plan = p.equipes?.plan ?? "gratuit";
  const choix = choisir({ classement, plan, secteurs: p.secteurs, dejaRecues, date: maintenant });
  if (!choix.length) continue;
  const { sujet, html, texte } = composer({ prenom: p.nom?.split(" ")[0] ?? null, opportunites: choix, site: env.SITE_URL, date: maintenant });

  if (ESSAI) {
    console.log(`\n${p.email} (${plan}) : ${sujet}\n${choix.map((c) => `  #${c.rang} ${c.nom}`).join("\n")}`);
    continue;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json", "idempotency-key": `radar-matin-${p.id}-${jour}` },
    body: JSON.stringify({
      from: env.EMAIL_EXPEDITEUR,
      to: [p.email],
      subject: sujet,
      html,
      text: texte,
      headers: { "List-Unsubscribe": `<${env.SITE_URL}/compte>` },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const reponse = await res.text();
  const ok = res.ok;
  if (ok) envoyes++;
  else refuses++;
  await sansErreur(
    db.from("emails_matin").insert({
      utilisateur_id: p.id,
      jour,
      opportunites: choix.map((c) => c.nom),
      statut: ok ? "envoye" : "refuse",
      erreur: ok ? null : `${res.status} ${reponse}`.slice(0, 500),
    }),
  );
  await pause(600); // Resend gratuit : 2 envois par seconde au plus
}
console.log(ESSAI ? "\nEssai terminé, rien envoyé." : `Emails du matin : ${envoyes} envoyés, ${refuses} refusés (mode démo : seule l'adresse du compte Resend est acceptée).`);
