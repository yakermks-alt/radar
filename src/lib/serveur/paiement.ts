import "server-only";
import Stripe from "stripe";
import { adresseSite, envStripe } from "../env";
import { planSelonStatut } from "../offres";
import { baseServeur } from "./base";

// Abonnement Pro par équipe, Stripe en mode test (envStripe refuse toute clé « live »).
// La source de vérité est Stripe : à chaque événement d'abonnement, on relit l'abonnement chez Stripe
// plutôt que de faire confiance à l'ordre d'arrivée des webhooks.

export function stripeActif(): boolean {
  return envStripe() !== null;
}

function client() {
  const env = envStripe();
  if (!env) throw new Error("Paiement pas encore configuré sur ce site.");
  return { stripe: new Stripe(env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 15_000 }), env };
}

// Page de paiement Stripe pour passer une équipe en Pro. Le client Stripe est créé une seule fois
// par équipe et réutilisé ensuite (le portail de facturation s'appuie dessus).
export async function lienPaiement(equipe: { id: number; nom: string; stripeClient: string | null }, email: string): Promise<string> {
  const { stripe, env } = client();
  let clientStripe = equipe.stripeClient;
  if (!clientStripe) {
    const c = await stripe.customers.create({ email, name: equipe.nom, metadata: { equipe_id: String(equipe.id) } }, { idempotencyKey: `radar-client-equipe-${equipe.id}` });
    const { error } = await baseServeur().from("equipes").update({ stripe_client: c.id }).eq("id", equipe.id).is("stripe_client", null);
    if (error) throw new Error(error.message);
    clientStripe = c.id;
  }
  const site = adresseSite();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: clientStripe,
    client_reference_id: String(equipe.id),
    line_items: [{ price: env.STRIPE_PRIX_PRO, quantity: 1 }],
    subscription_data: { metadata: { equipe_id: String(equipe.id) } },
    success_url: `${site}/equipe?paiement=ok`,
    cancel_url: `${site}/equipe?paiement=annule`,
    locale: "fr",
  });
  if (!session.url) throw new Error("Stripe n'a pas renvoyé de page de paiement.");
  return session.url;
}

// Portail Stripe : changer de carte, voir les factures, résilier.
export async function lienPortail(stripeClient: string): Promise<string> {
  const { stripe } = client();
  const portail = await stripe.billingPortal.sessions.create({ customer: stripeClient, return_url: `${adresseSite()}/equipe`, locale: "fr" });
  return portail.url;
}

// Webhook : signature vérifiée avec le secret du point de réception, événement traité une seule fois.
export async function traiterWebhook(corps: string, signature: string | null): Promise<{ statut: number; message: string }> {
  const { stripe, env } = client();
  if (!signature) return { statut: 400, message: "Signature absente" };
  let evenement: Stripe.Event;
  try {
    evenement = await stripe.webhooks.constructEventAsync(corps, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return { statut: 400, message: "Signature invalide" };
  }
  if (evenement.livemode) return { statut: 400, message: "Événement live refusé" };

  const db = baseServeur();
  const { data: nouveau, error } = await db.from("stripe_evenements").upsert({ id: evenement.id, type: evenement.type }, { onConflict: "id", ignoreDuplicates: true }).select("id");
  if (error) throw new Error(error.message);
  if (!nouveau?.length) return { statut: 200, message: "Déjà traité" };

  try {
    let abonnement: string | null = null;
    if (evenement.type === "checkout.session.completed") {
      const s = evenement.data.object;
      abonnement = typeof s.subscription === "string" ? s.subscription : (s.subscription?.id ?? null);
    } else if (evenement.type.startsWith("customer.subscription.")) {
      abonnement = (evenement.data.object as Stripe.Subscription).id;
    }
    if (abonnement) await synchroniser(stripe, abonnement);
  } catch (e) {
    // Échec : on oublie l'événement pour que le renvoi automatique de Stripe le retraite.
    await db.from("stripe_evenements").delete().eq("id", evenement.id);
    throw e;
  }
  return { statut: 200, message: "ok" };
}

async function synchroniser(stripe: Stripe, id: string): Promise<void> {
  const sub = await stripe.subscriptions.retrieve(id);
  const equipe = Number(sub.metadata.equipe_id);
  if (!Number.isInteger(equipe) || equipe <= 0) throw new Error(`Abonnement ${id} sans équipe`);
  const clientStripe = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const fin = sub.items.data[0]?.current_period_end;
  const plan = planSelonStatut(sub.status);
  let requete = baseServeur()
    .from("equipes")
    .update({
      plan,
      stripe_abonnement: plan === "pro" ? sub.id : null,
      abonnement_statut: sub.cancel_at_period_end && plan === "pro" ? "resiliation_prevue" : sub.status,
      fin_periode: fin ? new Date(fin * 1000).toISOString() : null,
    })
    .eq("id", equipe)
    .eq("stripe_client", clientStripe); // l'abonnement doit bien appartenir au client Stripe de cette équipe
  // Un ancien abonnement résilié ne doit pas repasser en gratuit une équipe qui s'est réabonnée depuis.
  if (plan === "gratuit") requete = requete.or(`stripe_abonnement.is.null,stripe_abonnement.eq.${sub.id}`);
  const { error } = await requete;
  if (error) throw new Error(error.message);
}
