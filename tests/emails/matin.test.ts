import { describe, expect, it } from "vitest";
import { choisir, composer, type OpportuniteEmail } from "../../src/lib/emails/matin";
import { selectionDuJour } from "../../src/lib/offres";

const op = (rang: number, secteur = "compta"): OpportuniteEmail => ({ rang, nom: `Besoin ${rang}`, resume: null, secteur, score: 10 - rang / 10, entreprises: null });
const classement = Array.from({ length: 40 }, (_, i) => op(i + 1, i === 30 ? "sante-liberal-2" : "compta"));
const date = new Date("2026-10-01T05:00:00Z");

describe("choix de l'email du matin", () => {
  it("gratuit : exactement le lot du jour affiché sur le site", () => {
    const choix = choisir({ classement, plan: "gratuit", secteurs: [], dejaRecues: new Set(), date });
    expect(choix).toEqual(selectionDuJour(classement.slice(0, 20), date));
  });

  it("pro : les secteurs suivis d'abord, même hors du Top 20", () => {
    const choix = choisir({ classement, plan: "pro", secteurs: ["sante-liberal"], dejaRecues: new Set(), date });
    expect(choix.map((c) => c.rang)).toEqual([31, 1, 2]);
  });

  it("pro : saute ce qui a déjà été reçu, et n'envoie rien s'il n'y a rien de neuf", () => {
    const dejaRecues = new Set(["Besoin 1", "Besoin 2"]);
    expect(choisir({ classement, plan: "pro", secteurs: [], dejaRecues, date }).map((c) => c.rang)).toEqual([3, 4, 5]);
    const tout = new Set(classement.map((c) => c.nom));
    expect(choisir({ classement, plan: "pro", secteurs: [], dejaRecues: tout, date })).toEqual([]);
  });
});

describe("mise en forme de l'email", () => {
  it("échappe tout texte venu de la base ou de l'IA", () => {
    const piege = { ...op(1), nom: `<script>alert(1)</script>`, resume: `"><img src=x onerror=alert(1)>` };
    const { html, texte } = composer({ prenom: "<b>Max</b>", opportunites: [piege], site: "https://radar.exemple", date });
    expect(html).not.toMatch(/<script>|<img|<b>Max/);
    expect(html).toContain("&lt;script&gt;");
    expect(texte).toContain("<script>alert(1)</script>"); // la version texte n'est pas interprétée
  });

  it("contient le lien d'enquête et le lien de désinscription", () => {
    const { sujet, html } = composer({ prenom: "Maksen", opportunites: [op(1), op(2)], site: "https://radar.exemple", date });
    expect(sujet).toMatch(/^Radar · 2 opportunités du jeudi 1 octobre/);
    expect(html).toContain("https://radar.exemple/enquetes?sujet=Besoin+1");
    expect(html).toContain("https://radar.exemple/compte");
  });
});
