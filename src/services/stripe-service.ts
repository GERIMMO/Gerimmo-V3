import type Stripe from "stripe";

import { getStripe, getStripeWebhookSecret } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapSubscriptionStatus } from "@/services/billing/subscription-status";

import { requireSuperAdmin } from "./administration-service";

export async function createCheckout(organizationId: string, planId: string, email: string, origin: string) {
  const admin = createAdminClient();
  const [organization, plan, existing] = await Promise.all([
    admin.from("organizations").select("id,name").eq("id", organizationId).single(),
    admin.from("subscription_plans").select("*").eq("id", planId).eq("is_purchasable", true).single(),
    admin
      .from("organization_subscriptions")
      .select("id,stripe_customer_id")
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);
  if (organization.error || plan.error) throw organization.error ?? plan.error;
  if (!plan.data.stripe_price_id) throw new Error("Le prix Stripe de cette offre n’est pas configuré.");
  const stripe = getStripe();
  let customerId = existing.data?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create(
      { email, name: organization.data.name, metadata: { organization_id: organizationId } },
      { idempotencyKey: `customer:${organizationId}` },
    );
    customerId = customer.id;
  }
  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer: customerId,
      // Les frais de mise en place sont un tarif « one-time » : dans un paiement en mode
      // abonnement, Stripe les ajoute à la première facture. Ils étaient affichés au client
      // sans jamais être encaissés.
      line_items: [
        { price: plan.data.stripe_price_id, quantity: 1 },
        ...(plan.data.stripe_setup_price_id ? [{ price: plan.data.stripe_setup_price_id, quantity: 1 }] : []),
      ],
      subscription_data: {
        trial_period_days: plan.data.trial_days,
        // `kind` distingue l'abonnement mensuel de l'abonnement annuel créé ensuite : sans
        // lui, la création du second déclencherait à son tour la création d'un troisième.
        metadata: { organization_id: organizationId, plan_id: planId, kind: "monthly" },
      },
      success_url: `${origin}/dashboard/abonnement?checkout=success`,
      cancel_url: `${origin}/dashboard/abonnement?checkout=cancelled`,
      metadata: { organization_id: organizationId, plan_id: planId },
      allow_promotion_codes: true,
    },
    { idempotencyKey: `checkout:${organizationId}:${planId}:${new Date().toISOString().slice(0, 10)}` },
  );
  await admin.from("organization_subscriptions").upsert(
    {
      organization_id: organizationId,
      plan_id: planId,
      plan_key: plan.data.code,
      billing_interval: plan.data.billing_interval,
      stripe_customer_id: customerId,
      status: "trial",
      trial_started_at: new Date().toISOString(),
      trial_ends_at: new Date(Date.now() + plan.data.trial_days * 86400000).toISOString(),
    },
    { onConflict: "organization_id" },
  );
  return { url: session.url };
}

export async function createBillingPortal(organizationId: string, origin: string) {
  const { data, error } = await createAdminClient()
    .from("organization_subscriptions")
    .select("stripe_customer_id")
    .eq("organization_id", organizationId)
    .single();
  if (error || !data.stripe_customer_id) throw new Error("Client Stripe non configuré.");
  return getStripe().billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${origin}/dashboard/abonnement`,
  });
}

/**
 * Retrouve l'organisation d'un abonnement Stripe dont la metadata ne la porte pas :
 * d'abord par l'identifiant d'abonnement déjà enregistré, puis par le client Stripe.
 */
async function findOrganizationForStripeSubscription(
  admin: ReturnType<typeof createAdminClient>,
  subscriptionId: string,
  customer: Stripe.Subscription["customer"],
): Promise<string | null> {
  const bySubscription = await admin
    .from("organization_subscriptions")
    .select("organization_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (bySubscription.error) throw bySubscription.error;
  if (bySubscription.data) return bySubscription.data.organization_id;

  const customerId = typeof customer === "string" ? customer : customer?.id;
  if (!customerId) return null;
  const byCustomer = await admin
    .from("organization_subscriptions")
    .select("organization_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (byCustomer.error) throw byCustomer.error;
  return byCustomer.data?.organization_id ?? null;
}

/**
 * Ouvre l'abonnement annuel « gestion » qui accompagne l'abonnement mensuel.
 *
 * Stripe interdit de mélanger plusieurs rythmes de facturation dans un même abonnement :
 * la gestion annuelle est donc un abonnement distinct, rattaché au même client et au même
 * moyen de paiement (enregistré lors du paiement initial).
 *
 * Sa fin d'essai est alignée sur celle du mensuel : le client ne paie rien pendant l'essai.
 * La clé d'idempotence évite tout doublon si Stripe rejoue l'événement.
 */
async function ensureAnnualSubscription(
  admin: ReturnType<typeof createAdminClient>,
  stripe: ReturnType<typeof getStripe>,
  monthly: Stripe.Subscription,
) {
  const planId = monthly.metadata.plan_id;
  if (!planId) return;

  const plan = await admin.from("subscription_plans").select("stripe_annual_price_id").eq("id", planId).maybeSingle();
  if (plan.error) throw plan.error;
  const annualPriceId = plan.data?.stripe_annual_price_id;
  if (!annualPriceId) return; // Offre sans gestion annuelle : rien à facturer.

  const customerId = typeof monthly.customer === "string" ? monthly.customer : monthly.customer.id;
  await stripe.subscriptions.create(
    {
      customer: customerId,
      items: [{ price: annualPriceId, quantity: 1 }],
      trial_end: monthly.trial_end ?? undefined,
      metadata: {
        organization_id: monthly.metadata.organization_id ?? "",
        plan_id: planId,
        kind: "annual",
        monthly_subscription_id: monthly.id,
      },
    },
    { idempotencyKey: `annual:${monthly.id}` },
  );
}

/** Un tarif enregistré existe-t-il réellement dans le mode Stripe courant (test ou live) ? */
async function priceExists(stripe: ReturnType<typeof getStripe>, priceId: string | null): Promise<boolean> {
  if (!priceId) return false;
  try {
    await stripe.prices.retrieve(priceId);
    return true;
  } catch {
    // Un identifiant de tarif créé en mode test est introuvable en mode live, et
    // réciproquement : il faut alors le recréer dans le mode courant.
    return false;
  }
}

/**
 * Crée dans Stripe les tarifs manquants de chaque offre, à partir des montants enregistrés
 * en base, puis mémorise les identifiants obtenus.
 *
 * Chaque offre a jusqu'à trois tarifs : abonnement mensuel, frais de mise en place (une
 * seule fois) et gestion annuelle. Les créer à la main représentait 21 saisies, avec autant
 * d'occasions de se tromper de montant ou de coller le mauvais identifiant.
 *
 * Idempotent ET conscient du mode : chaque identifiant déjà enregistré est vérifié auprès de
 * Stripe ; s'il n'existe pas dans le mode courant (cas du passage de test à live), il est
 * recréé. Relancer l'opération après avoir basculé les clés suffit donc à préparer le live.
 */
export async function syncStripePrices() {
  await requireSuperAdmin();
  const stripe = getStripe();
  const admin = createAdminClient();

  const plans = await admin
    .from("subscription_plans")
    .select(
      "id,code,name,currency,amount_cents,setup_fee_cents,annual_fee_cents,stripe_product_id,stripe_price_id,stripe_setup_price_id,stripe_annual_price_id",
    )
    .eq("is_purchasable", true);
  if (plans.error) throw plans.error;

  const report: Array<{ code: string; created: string[] }> = [];

  for (const plan of plans.data ?? []) {
    const created: string[] = [];
    const patch: Record<string, string> = {};
    const currency = (plan.currency ?? "eur").toLowerCase();

    let productId = plan.stripe_product_id;
    if (!productId || !(await priceExists(stripe, plan.stripe_price_id))) {
      // Produit recréé en même temps que les tarifs quand on change de mode.
      const product = await stripe.products.create({ name: `GERIMMO — ${plan.name}`, metadata: { code: plan.code } });
      productId = product.id;
      patch.stripe_product_id = productId;
      created.push("produit");
    }

    if (!(await priceExists(stripe, plan.stripe_price_id))) {
      const price = await stripe.prices.create({
        product: productId,
        currency,
        unit_amount: plan.amount_cents,
        recurring: { interval: "month" },
        nickname: `${plan.code} — mensuel`,
      });
      patch.stripe_price_id = price.id;
      created.push("mensuel");
    }

    if (plan.setup_fee_cents > 0 && !(await priceExists(stripe, plan.stripe_setup_price_id))) {
      const price = await stripe.prices.create({
        product: productId,
        currency,
        unit_amount: plan.setup_fee_cents,
        nickname: `${plan.code} — mise en place`,
      });
      patch.stripe_setup_price_id = price.id;
      created.push("mise en place");
    }

    if (plan.annual_fee_cents > 0 && !(await priceExists(stripe, plan.stripe_annual_price_id))) {
      const price = await stripe.prices.create({
        product: productId,
        currency,
        unit_amount: plan.annual_fee_cents,
        recurring: { interval: "year" },
        nickname: `${plan.code} — gestion annuelle`,
      });
      patch.stripe_annual_price_id = price.id;
      created.push("gestion annuelle");
    }

    if (Object.keys(patch).length > 0) {
      const applied = await admin.from("subscription_plans").update(patch).eq("id", plan.id).select("id");
      if (applied.error) throw applied.error;
      if (!applied.data?.length) {
        throw new Error(`Tarifs Stripe crees pour ${plan.code} mais non enregistres en base.`);
      }
    }

    report.push({ code: plan.code, created });
  }

  return { plans: report, mode: process.env.STRIPE_SECRET_KEY?.startsWith("sk_live") ? "live" : "test" };
}

export async function processStripeWebhook(rawBody: string, signature: string) {
  const stripe = getStripe();
  const event = stripe.webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
  const admin = createAdminClient();
  const inserted = await admin
    .from("stripe_webhook_events")
    .insert({ stripe_event_id: event.id, event_type: event.type, payload: event as unknown as Record<string, unknown> })
    .select("id")
    .maybeSingle();
  if (inserted.error?.code === "23505") return { duplicate: true };
  if (inserted.error || !inserted.data) throw inserted.error;
  try {
    await admin.from("stripe_webhook_events").update({ status: "processing", attempts: 1 }).eq("id", inserted.data.id);
    if (event.type.startsWith("customer.subscription.")) {
      const subscription = event.data.object as Stripe.Subscription;

      // L'abonnement annuel (gestion) est un abonnement Stripe DISTINCT du mensuel. Il ne
      // doit pas écraser organization_subscriptions, dont stripe_subscription_id désigne
      // l'abonnement principal — sinon les résiliations du mensuel ne seraient plus suivies.
      if (subscription.metadata.kind !== "annual") {
        // À la création du mensuel, ouvrir l'abonnement annuel correspondant. Le garde
        // `kind === "monthly"` évite la récursion : la création de l'annuel émet elle aussi
        // un customer.subscription.created.
        if (event.type === "customer.subscription.created" && subscription.metadata.kind === "monthly") {
          await ensureAnnualSubscription(admin, stripe, subscription);
        }

        // metadata.organization_id n'est posé qu'au paiement initial (subscription_data.metadata).
        // Un abonnement créé depuis le tableau de bord Stripe, migré, ou recréé lors d'un
        // changement de formule arrive donc SANS. Auparavant le bloc était simplement sauté et
        // l'événement marqué « traité » : une résiliation ou un échec de paiement n'était jamais
        // répercuté (accès maintenu sans paiement), et rien ne le signalait. On retrouve
        // désormais l'organisation par l'abonnement puis par le client Stripe, et à défaut on
        // échoue bruyamment — l'événement passe en « failed » et Stripe le rejouera.
        const organizationId =
          subscription.metadata.organization_id ??
          (await findOrganizationForStripeSubscription(admin, subscription.id, subscription.customer));
        if (!organizationId) {
          throw new Error(
            `Abonnement Stripe ${subscription.id} rattache a aucune organisation connue (metadata absente).`,
          );
        }
        {
          const period = subscription.items.data[0]?.current_period_end;
          const applied = await admin
            .from("organization_subscriptions")
            .update({
              stripe_subscription_id: subscription.id,
              status: mapSubscriptionStatus(subscription.status),
              current_period_start: subscription.items.data[0]?.current_period_start
                ? new Date(subscription.items.data[0].current_period_start * 1000).toISOString()
                : null,
              current_period_end: period ? new Date(period * 1000).toISOString() : null,
              next_invoice_at: period ? new Date(period * 1000).toISOString() : null,
              cancelled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
            })
            .eq("organization_id", organizationId)
            .select("id");
          if (applied.error) throw applied.error;
          if (!applied.data?.length) {
            throw new Error(
              `Abonnement Stripe ${subscription.id} : aucune ligne mise a jour pour l organisation ${organizationId}.`,
            );
          }
        }
      }
    }
    if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        typeof invoice.parent?.subscription_details?.subscription === "string"
          ? invoice.parent.subscription_details.subscription
          : null;
      const local = subscriptionId
        ? await admin
            .from("organization_subscriptions")
            .select("id,organization_id")
            .eq("stripe_subscription_id", subscriptionId)
            .maybeSingle()
        : { data: null, error: null };
      if (local.error) throw local.error;

      // Rattacher par l'abonnement ne suffit pas, pour deux raisons observées en conditions
      // réelles :
      //  - Stripe envoie invoice.paid AVANT customer.subscription.created (constaté à moins
      //    d'une seconde d'écart) : au moment de la facture, l'abonnement n'est pas encore
      //    enregistré ;
      //  - la gestion annuelle est un abonnement distinct, volontairement absent de
      //    organization_subscriptions : ses factures ne s'y retrouveront jamais.
      // Le client Stripe, lui, est enregistré dès la création du paiement : c'est le point
      // d'ancrage fiable.
      let target = local.data;
      if (!target) {
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          const byCustomer = await admin
            .from("organization_subscriptions")
            .select("id,organization_id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();
          if (byCustomer.error) throw byCustomer.error;
          target = byCustomer.data;
        }
      }

      // Une facture qu'on ne sait rattacher à aucune organisation était ignorée en silence,
      // l'événement restant marqué « traité » : le client était débité sans aucune facture
      // dans l'application. On échoue désormais pour que Stripe rejoue l'événement.
      if (subscriptionId && !target) {
        throw new Error(`Facture Stripe ${invoice.id} : aucune organisation trouvee (abonnement ${subscriptionId}).`);
      }
      if (target) {
        await admin.from("billing_invoices").upsert(
          {
            organization_id: target.organization_id,
            subscription_id: target.id,
            number: invoice.number ?? invoice.id,
            status: event.type === "invoice.paid" ? "paid" : "open",
            currency: invoice.currency,
            subtotal_cents: invoice.subtotal,
            discount_cents: Math.max(0, invoice.subtotal - invoice.total),
            total_cents: invoice.total,
            amount_paid_cents: invoice.amount_paid,
            due_at: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
            paid_at: event.type === "invoice.paid" ? new Date().toISOString() : null,
            stripe_invoice_id: invoice.id,
            hosted_invoice_url: invoice.hosted_invoice_url,
            invoice_pdf_url: invoice.invoice_pdf,
          },
          { onConflict: "stripe_invoice_id" },
        );
        await admin.from("automation_events").upsert(
          {
            organization_id: target.organization_id,
            event_type: event.type === "invoice.paid" ? "payment.succeeded" : "payment.failed",
            aggregate_type: "invoice",
            aggregate_id: target.id,
            payload: { stripe_invoice_id: invoice.id },
            idempotency_key: `stripe:${event.id}`,
          },
          { onConflict: "idempotency_key" },
        );
      }
    }
    await admin
      .from("stripe_webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("id", inserted.data.id);
    return { processed: true };
  } catch (error) {
    await admin
      .from("stripe_webhook_events")
      .update({ status: "failed", last_error: error instanceof Error ? error.message : "Erreur Stripe" })
      .eq("id", inserted.data.id);
    throw error;
  }
}

export async function simulatePayment(subscriptionId: string, outcome: "succeeded" | "failed") {
  await requireSuperAdmin();
  const admin = createAdminClient();
  const subscription = await admin
    .from("organization_subscriptions")
    .select("id,organization_id")
    .eq("id", subscriptionId)
    .single();
  if (subscription.error) throw subscription.error;
  const invoice = await admin
    .from("billing_invoices")
    .insert({
      organization_id: subscription.data.organization_id,
      subscription_id: subscriptionId,
      number: `SIM-${Date.now()}`,
      status: outcome === "succeeded" ? "paid" : "open",
      total_cents: 1000,
      amount_paid_cents: outcome === "succeeded" ? 1000 : 0,
      paid_at: outcome === "succeeded" ? new Date().toISOString() : null,
      metadata: { simulated: true },
    })
    .select("id")
    .single();
  if (invoice.error) throw invoice.error;
  await admin.from("billing_payments").insert({
    organization_id: subscription.data.organization_id,
    subscription_id: subscriptionId,
    invoice_id: invoice.data.id,
    status: outcome,
    amount_cents: 1000,
    paid_at: outcome === "succeeded" ? new Date().toISOString() : null,
  });
  return invoice.data;
}
