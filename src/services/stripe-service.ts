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
      line_items: [{ price: plan.data.stripe_price_id, quantity: 1 }],
      subscription_data: {
        trial_period_days: plan.data.trial_days,
        metadata: { organization_id: organizationId, plan_id: planId },
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
      // Une facture rattachée à un abonnement introuvable en base était ignorée en silence,
      // l'événement restant marqué « traité » : le client était débité par Stripe sans aucune
      // facture dans l'application ni confirmation de paiement. On échoue désormais pour que
      // l'événement soit rejoué une fois l'abonnement rattaché.
      if (subscriptionId && !local.data) {
        throw new Error(`Facture Stripe ${invoice.id} : abonnement ${subscriptionId} inconnu en base.`);
      }
      if (local.data) {
        await admin.from("billing_invoices").upsert(
          {
            organization_id: local.data.organization_id,
            subscription_id: local.data.id,
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
            organization_id: local.data.organization_id,
            event_type: event.type === "invoice.paid" ? "payment.succeeded" : "payment.failed",
            aggregate_type: "invoice",
            aggregate_id: local.data.id,
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
