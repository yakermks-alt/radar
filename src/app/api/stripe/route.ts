import { stripeActif, traiterWebhook } from "@/lib/serveur/paiement";

// Webhook Stripe (mode test). Corps lu brut : la signature porte sur les octets exacts.
export async function POST(requete: Request) {
  if (!stripeActif()) return new Response("Paiement non configuré", { status: 503 });
  const corps = await requete.text();
  if (corps.length > 256_000) return new Response("Trop gros", { status: 413 });
  try {
    const { statut, message } = await traiterWebhook(corps, requete.headers.get("stripe-signature"));
    return new Response(message, { status: statut });
  } catch (e) {
    console.error("Webhook Stripe :", e instanceof Error ? e.message : e);
    return new Response("Erreur", { status: 500 }); // Stripe renverra l'événement plus tard
  }
}
