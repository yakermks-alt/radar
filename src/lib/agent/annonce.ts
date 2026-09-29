// Signal temps réel « l'enquête a avancé » envoyé sur le canal enquete:<jeton> (Supabase Realtime).
// Le message ne contient rien d'autre que le type d'évènement : la page relit la base elle-même,
// donc un faux message (le canal est public pour qui connaît le jeton) ne peut rien afficher de faux.
export type Evenement = "etape" | "fin" | "arret";

export const canalEnquete = (jeton: string) => `enquete:${jeton}`;

export async function annoncer(jeton: string, evenement: Evenement, f: typeof fetch = fetch): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SECRET_KEY;
  if (!url || !cle) return;
  // Un signal perdu n'est pas grave : la page vérifie aussi d'elle-même toutes les quelques secondes.
  await f(`${url}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: cle },
    body: JSON.stringify({ messages: [{ topic: canalEnquete(jeton), event: evenement, payload: {}, private: false }] }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}
