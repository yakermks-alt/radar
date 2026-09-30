import { describe, expect, it } from "vitest";
import { z } from "zod";
import { texteCoupe } from "../../src/lib/ia/gemini";

describe("texteCoupe", () => {
  it("coupe un texte trop long au lieu d'échouer (nuit du 30/09)", () => {
    const r = texteCoupe(80).safeParse("x".repeat(120));
    expect(r.success).toBe(true);
    expect(r.data).toHaveLength(80);
    expect(r.data?.endsWith("…")).toBe(true);
  });

  it("laisse un texte court intact", () => {
    expect(texteCoupe(80).parse("Facturation mobile des auto-entrepreneurs")).toBe("Facturation mobile des auto-entrepreneurs");
  });

  it("envoie toujours la limite à Gemini dans le schéma JSON", () => {
    expect(z.toJSONSchema(texteCoupe(40), { target: "draft-7" })).toMatchObject({ type: "string", maxLength: 40 });
  });
});
