import { describe, expect, it } from "vitest";
import { additionner, mesuresVides, prochaineRemiseQuota } from "../../src/lib/agent/mesures";

describe("additionner", () => {
  it("cumule deux passages d'une même enquête, modèle par modèle", () => {
    const premier = { ...mesuresVides(), appels_ia: { lite: 6 }, recherches: 2, duree_s: 40.2 };
    const second = { ...mesuresVides(), appels_ia: { lite: 3, flash: 1 }, recherches: 1, pages_cache: 1, duree_s: 20.1 };
    expect(additionner(premier, second)).toMatchObject({ appels_ia: { lite: 9, flash: 1 }, recherches: 3, pages_cache: 1, duree_s: 60.3 });
  });

  it("part de zéro pour une enquête sans mesures (créée avant la phase 5)", () => {
    expect(additionner({}, { ...mesuresVides(), pages: 2 })).toEqual({ ...mesuresVides(), pages: 2 });
    expect(additionner(null, mesuresVides())).toEqual(mesuresVides());
  });
});

describe("prochaineRemiseQuota", () => {
  it("attend 8 h 05 UTC le jour même s'il n'est pas passé", () => {
    expect(prochaineRemiseQuota(new Date("2026-09-29T03:00:00Z")).toISOString()).toBe("2026-09-29T08:05:00.000Z");
  });
  it("attend le lendemain sinon", () => {
    expect(prochaineRemiseQuota(new Date("2026-09-29T21:30:00Z")).toISOString()).toBe("2026-09-30T08:05:00.000Z");
  });
});
