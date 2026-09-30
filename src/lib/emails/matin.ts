// Email du matin (phase 6) : choix des 3 opportunités et mise en forme. Sans accès à la base ni au
// réseau, pour être testé tel quel (tests/emails).
import { selectionDuJour, type Plan } from "../offres";

export type OpportuniteEmail = { rang: number; nom: string; resume: string | null; secteur: string | null; score: number; entreprises: number | null };

export const PAR_EMAIL = 3;

// Gratuit : le lot du jour (le même que sur le site). Pro : d'abord les secteurs suivis, puis le haut
// du classement, en sautant ce que la personne a déjà reçu ces 14 derniers jours. Rien de neuf : rien.
export function choisir(o: { classement: OpportuniteEmail[]; plan: Plan; secteurs: string[]; dejaRecues: Set<string>; date: Date }): OpportuniteEmail[] {
  if (o.plan === "gratuit") return selectionDuJour(o.classement.filter((x) => x.rang <= 20), o.date, PAR_EMAIL);
  const neuves = o.classement.filter((x) => !o.dejaRecues.has(x.nom));
  const suivies = neuves.filter((x) => x.secteur && o.secteurs.includes(x.secteur.replace(/-\d+$/, "")));
  const autres = neuves.filter((x) => x.rang <= 20 && !suivies.includes(x));
  return [...suivies, ...autres].slice(0, PAR_EMAIL);
}

const echapper = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const virgule = (n: number) => n.toFixed(1).replace(".", ",");

// Email simple en tableaux (compatible avec les messageries), couleurs de la charte, version texte.
export function composer(o: { prenom: string | null; opportunites: OpportuniteEmail[]; site: string; date: Date }): { sujet: string; html: string; texte: string } {
  const jour = o.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
  const sujet = `Radar · ${o.opportunites.length} opportunité${o.opportunites.length > 1 ? "s" : ""} du ${jour}`;
  const bonjour = o.prenom ? `Bonjour ${o.prenom},` : "Bonjour,";
  const lien = (nom: string) => `${o.site}/enquetes?${new URLSearchParams({ sujet: nom.slice(0, 200) })}`;

  const cartes = o.opportunites
    .map(
      (x) => `<tr><td style="padding:0 0 12px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;border:1px solid #DDE5E1">
<tr><td style="padding:16px 18px;font-family:Arial,sans-serif;color:#0F1B17">
<div style="font-size:12px;color:#5B6B64">#${x.rang} · score ${virgule(x.score)}/10${x.entreprises ? ` · ${x.entreprises.toLocaleString("fr-FR")} entreprises` : ""}</div>
<div style="font-size:16px;font-weight:bold;margin-top:4px">${echapper(x.nom)}</div>
${x.resume ? `<div style="font-size:14px;line-height:1.5;color:#3D4A44;margin-top:6px">${echapper(x.resume)}</div>` : ""}
<a href="${echapper(lien(x.nom))}" style="display:inline-block;margin-top:12px;background:#0B7A55;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:9px 14px;border-radius:10px">Enquêter</a>
</td></tr></table></td></tr>`,
    )
    .join("\n");

  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#F3F5F4">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F5F4"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 0 16px 0;font-family:Arial,sans-serif;color:#0F1B17"><div style="font-size:20px;font-weight:bold">Radar</div>
<div style="font-size:14px;color:#3D4A44;margin-top:8px">${echapper(bonjour)} voici les opportunités du ${echapper(jour)}, tirées des plaintes réelles des clients de logiciels professionnels.</div></td></tr>
${cartes}
<tr><td style="padding:8px 0 0 0;font-family:Arial,sans-serif;font-size:12px;color:#5B6B64">Tu reçois cet email parce que l'email du matin est activé sur ton compte Radar. <a href="${echapper(o.site)}/compte" style="color:#0B7A55">Le désactiver</a>.</td></tr>
</table></td></tr></table></body></html>`;

  const texte = [
    bonjour,
    `Voici les opportunités du ${jour} :`,
    "",
    ...o.opportunites.map((x) => `#${x.rang} ${x.nom} (score ${virgule(x.score)}/10)${x.resume ? `\n${x.resume}` : ""}\nEnquêter : ${lien(x.nom)}\n`),
    `Désactiver l'email du matin : ${o.site}/compte`,
  ].join("\n");

  return { sujet, html, texte };
}
