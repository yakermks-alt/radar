// Appels à Gemini (offre gratuite) avec réponse JSON validée par un schéma zod.
// Flash-Lite par défaut : Flash n'a qu'environ 20 requêtes/jour en gratuit (voir docs/LIMITES.md).
import { z } from "zod";
import { pause } from "../collecte/appstore";

export const MODELES = {
  leger: "gemini-3.5-flash-lite", // tri, extraction, étapes de l'agent (~500 requêtes/jour)
  redaction: "gemini-3.8-flash", // rédaction finale uniquement (~20 requêtes/jour)
} as const;

type Options<T extends z.ZodType> = {
  modele?: string;
  systeme: string;
  prompt: string;
  schema: T;
  cle?: string;
};

export class QuotaEpuise extends Error {}

const reponse = z.object({
  candidates: z
    .array(z.object({ content: z.object({ parts: z.array(z.object({ text: z.string().optional() })) }).optional() }))
    .optional(),
  usageMetadata: z.object({ totalTokenCount: z.number().optional() }).optional(),
});

export async function genererJson<T extends z.ZodType>(o: Options<T>): Promise<z.infer<T>> {
  const cle = o.cle ?? process.env.GEMINI_API_KEY;
  if (!cle) throw new Error("GEMINI_API_KEY manquante");
  const modele = o.modele ?? MODELES.leger;
  const corps = {
    systemInstruction: { parts: [{ text: o.systeme }] },
    contents: [{ role: "user", parts: [{ text: o.prompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(o.schema, { target: "draft-7" }),
    },
  };

  for (let essai = 1; essai <= 4; essai++) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": cle },
        body: JSON.stringify(corps),
        signal: AbortSignal.timeout(240_000),
      });
    } catch (e) {
      // Coupure réseau ou Gemini surchargé au-delà de 4 min : on réessaie.
      if (essai === 4) throw e;
      await pause(10_000 * essai);
      continue;
    }
    if (res.status === 429) {
      const texte = await res.text();
      // Quota du jour épuisé : inutile d'insister, l'appelant reprendra au prochain passage.
      if (/per ?day|PerDay/i.test(texte)) throw new QuotaEpuise(`Quota du jour épuisé pour ${modele}`);
      await pause(15_000 * essai); // limite par minute : on attend
      continue;
    }
    if (res.status >= 500) {
      await pause(5_000 * essai);
      continue;
    }
    if (!res.ok) throw new Error(`Gemini ${res.status} : ${(await res.text()).slice(0, 300)}`);

    const texte = reponse.parse(await res.json()).candidates?.[0]?.content?.parts.map((p) => p.text ?? "").join("");
    if (!texte) throw new Error("Réponse Gemini vide");
    const r = o.schema.safeParse(JSON.parse(texte));
    if (r.success) return r.data;
    if (essai === 4) throw new Error(`Réponse Gemini hors schéma : ${r.error.message.slice(0, 300)}`);
  }
  throw new Error(`Gemini indisponible (${modele})`);
}
