import { describe, expect, it } from "vitest";
import { cheminSur, messageErreurBase, nomAffiche } from "../../src/lib/comptes";
import { numeroDuJour, OFFRES, planSelonStatut, selectionDuJour } from "../../src/lib/offres";

describe("cheminSur (retour après connexion)", () => {
  it("garde un chemin interne", () => {
    expect(cheminSur("/rejoindre/abc?x=1")).toBe("/rejoindre/abc?x=1");
  });
  for (const piege of ["//pirate.fr", "https://pirate.fr", "/\\pirate.fr", "pirate", "/a\nb", "", "/" + "a".repeat(400)]) {
    it(`refuse ${JSON.stringify(piege.slice(0, 20))}`, () => {
      expect(cheminSur(piege)).toBe("/");
    });
  }
  it("refuse ce qui n'est pas du texte", () => {
    expect(cheminSur(["/a"])).toBe("/");
    expect(cheminSur(undefined, "/suivi")).toBe("/suivi");
  });
});

describe("nomAffiche", () => {
  it("prend le nom de Google, sinon celui de GitHub", () => {
    expect(nomAffiche({ full_name: " Maksen Y. ", name: "x" })).toBe("Maksen Y.");
    expect(nomAffiche({ user_name: "yakermks" })).toBe("yakermks");
    expect(nomAffiche({ name: "" })).toBeNull();
    expect(nomAffiche(undefined)).toBeNull();
    expect(nomAffiche({ name: "a".repeat(200) })).toHaveLength(80);
  });
});

describe("messageErreurBase", () => {
  it("traduit les codes levés par la base, et rien d'autre", () => {
    expect(messageErreurBase("quota_semaine")).toMatch(/enquête de la semaine/);
    expect(messageErreurBase('P0001: equipe_pleine')).toMatch(/complète/);
    expect(messageErreurBase("connection refused")).toBeNull();
  });
});

describe("offre gratuite : 3 opportunités par jour", () => {
  const classement = Array.from({ length: 20 }, (_, i) => i + 1);

  it("change de lot à minuit, heure de Paris", () => {
    const soir = new Date("2026-09-30T21:59:00Z"); // 23 h 59 à Paris
    const minuit = new Date("2026-09-30T22:00:00Z"); // 0 h à Paris
    expect(numeroDuJour(minuit)).toBe(numeroDuJour(soir) + 1);
    expect(selectionDuJour(classement, soir)).not.toEqual(selectionDuJour(classement, minuit));
  });

  it("parcourt tout le Top 20 en 7 jours, 3 par jour", () => {
    const vus = new Set<number>();
    for (let j = 0; j < 7; j++) {
      const lot = selectionDuJour(classement, new Date(Date.UTC(2026, 9, 1 + j, 10)));
      expect(lot).toHaveLength(OFFRES.gratuit.opportunites); // toujours 3, même le dernier lot
      expect(new Set(lot).size).toBe(lot.length);
      for (const x of lot) vus.add(x);
    }
    expect(vus.size).toBe(20);
  });

  it("renvoie tout quand le classement est court", () => {
    expect(selectionDuJour([1, 2], new Date())).toEqual([1, 2]);
  });
});

describe("planSelonStatut", () => {
  it("garde Pro tant que Stripe considère l'abonnement vivant", () => {
    for (const s of ["active", "trialing", "past_due"]) expect(planSelonStatut(s)).toBe("pro");
    for (const s of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]) expect(planSelonStatut(s)).toBe("gratuit");
  });
});
