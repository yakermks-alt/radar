// Prépare Stripe (mode test) pour Radar, sans passer par le tableau de bord : produit « Radar Pro »
// et son prix mensuel, point de réception des webhooks, portail client (résiliation, carte, factures).
// Rejouable : ce qui existe déjà est réutilisé. Les identifiants sont écrits dans .env.local, jamais affichés.
// Lancer : npx tsx --env-file=.env.local scripts/stripe/preparer.mts
import { readFileSync, writeFileSync } from "node:fs";
import Stripe from "stripe";
import { z } from "zod";
import { OFFRES } from "../../src/lib/offres";

const env = z
  .object({
    STRIPE_SECRET_KEY: z.string().startsWith("sk_test_", "Clé de test attendue (sk_test_…) : Radar ne fait aucun vrai paiement"),
    SITE_URL: z.url().default("https://radar-opportunites.netlify.app"),
  })
  .parse(process.env);
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const CLE_PRIX = "radar_pro_mensuel";
const EVENEMENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

// 1. Produit et prix (retrouvé par sa clé, sinon créé).
let prix = (await stripe.prices.list({ lookup_keys: [CLE_PRIX], active: true, limit: 1 })).data[0];
if (!prix) {
  const produit = await stripe.products.create({ name: "Radar Pro", description: "Tout le classement, 5 enquêtes par jour, alertes par secteur.", metadata: { radar: "pro" } });
  prix = await stripe.prices.create({
    product: produit.id,
    currency: "eur",
    unit_amount: OFFRES.pro.prixMois * 100,
    recurring: { interval: "month" },
    tax_behavior: "exclusive",
    lookup_key: CLE_PRIX,
  });
  console.log(`Produit et prix créés (${OFFRES.pro.prixMois} € HT par mois).`);
} else console.log("Prix déjà en place.");

// 2. Webhook. Stripe ne redonne le secret qu'à la création : s'il faut le secret, on recrée le point.
const url = `${env.SITE_URL}/api/stripe`;
const existants = (await stripe.webhookEndpoints.list({ limit: 100 })).data.filter((w) => w.url === url);
for (const w of existants) await stripe.webhookEndpoints.del(w.id);
const webhook = await stripe.webhookEndpoints.create({ url, enabled_events: EVENEMENTS, description: "Radar : abonnements des équipes" });
console.log(`Point de réception des webhooks ${existants.length ? "recréé" : "créé"} : ${url}`);

// 3. Portail client (obligatoire pour « Gérer l'abonnement »).
const portails = await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 });
if (!portails.data.length) {
  await stripe.billingPortal.configurations.create({
    business_profile: { headline: "Radar : gère ton abonnement Pro" },
    features: {
      customer_update: { enabled: true, allowed_updates: ["email", "name"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
    },
  });
  console.log("Portail client créé.");
} else console.log("Portail client déjà en place.");

// 4. .env.local : valeurs remplacées ou ajoutées, sans jamais les écrire à l'écran.
const chemin = ".env.local";
let contenu = readFileSync(chemin, "utf8");
for (const [cle, valeur] of Object.entries({ STRIPE_PRIX_PRO: prix.id, STRIPE_WEBHOOK_SECRET: webhook.secret! })) {
  const ligne = `${cle}=${valeur}`;
  contenu = new RegExp(`^${cle}=.*$`, "m").test(contenu) ? contenu.replace(new RegExp(`^${cle}=.*$`, "m"), ligne) : `${contenu.replace(/\n?$/, "\n")}${ligne}\n`;
}
writeFileSync(chemin, contenu);
console.log("STRIPE_PRIX_PRO et STRIPE_WEBHOOK_SECRET écrits dans .env.local.");
