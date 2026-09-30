// Appels à Gemini (offre gratuite) avec réponse JSON validée par un schéma zod.
// Flash-Lite par défaut : Flash n'a qu'environ 20 requêtes/jour en gratuit (voir docs/LIMITES.md).
import { z } from "zod";
import { pause } from "../collecte/appstore";

// Texte limité à `max` caractères : la limite est envoyée à Gemini, mais s'il la dépasse quand même
// (nuit du 30/09 : un nom de groupe trop long a fait échouer toute la collecte), on coupe au lieu d'échouer.
export function texteCoupe(max: number) {
  return z.string().overwrite((t) => (t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t)).max(max);
}

export const MODELES = {
  leger: "gemini-3.5-flash-lite", // tri, extraction, étapes de l'agent (~500 requêtes/jour)
  redaction: "gemini-3.8-flash", // rédaction finale uniquement (~20 requêtes/jour)
} as const;

// Modèles essayés dans l'ordre pour la rédaction : le plus récent est parfois saturé (503).
export const MODELES_REDACTION = [MODELES.redaction, "gemini-3.5-flash", MODELES.leger] as const;

type Options<T extends z.ZodType> = {
  modele?: string;
  systeme: string;
  prompt: string;
  schema: T;
  cle?: string;
  delaiMs?: number; // durée maximale d'un appel, réponse comprise (4 min par défaut)
  essais?: number; // 4 par défaut
};

export class QuotaEpuise extends Error {}
export class ModeleIndisponible extends Error {} // saturé ou en panne malgré les nouvelles tentatives

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

  const essais = o.essais ?? 4;
  for (let essai = 1; essai <= essais; essai++) {
    let res: Response;
    let brut: string;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": cle },
        body: JSON.stringify(corps),
        signal: AbortSignal.timeout(o.delaiMs ?? 240_000),
      });
      brut = await res.text(); // le délai couvre aussi la lecture de la réponse
    } catch (e) {
      // Coupure réseau, ou Gemini surchargé qui répond trop lentement : on réessaie.
      if (essai === essais) throw new ModeleIndisponible(`Gemini trop lent ou injoignable (${modele}) : ${(e as Error).message}`);
      await pause(5_000 * essai);
      continue;
    }
    if (res.status === 429) {
      // Quota du jour épuisé : inutile d'insister, l'appelant reprendra au prochain passage.
      if (/per ?day|PerDay/i.test(brut)) throw new QuotaEpuise(`Quota du jour épuisé pour ${modele}`);
      await pause(15_000 * essai); // limite par minute : on attend
      continue;
    }
    if (res.status >= 500) {
      await pause(5_000 * essai);
      continue;
    }
    if (!res.ok) throw new Error(`Gemini ${res.status} : ${brut.slice(0, 300)}`);

    const texte = reponse.parse(JSON.parse(brut)).candidates?.[0]?.content?.parts.map((p) => p.text ?? "").join("");
    if (!texte) throw new Error("Réponse Gemini vide");
    const r = o.schema.safeParse(JSON.parse(texte));
    if (r.success) return r.data;
    if (essai === essais) throw new Error(`Réponse Gemini hors schéma : ${r.error.message.slice(0, 300)}`);
  }
  throw new ModeleIndisponible(`Gemini indisponible (${modele})`);
}
