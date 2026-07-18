# 05 — Workflows n8n (état réel + guide d'activation)

> Statut au 2026-07-18 : **PRÉPARÉ, NON ACTIVÉ.** Les 8 workflows existent (`n8n/workflows/*.json`) mais sont `active: false`.
> n8n n'est pas critique : l'app fonctionne sans lui. Il ne gère que les **e-mails/relances** liés aux abonnements.
> Ne pas activer tant que **Stripe** (paiements) et le **service d'e-mails** ne sont pas configurés — sinon le robot n'a rien à traiter.

## Rôle de n8n

n8n est le « robot d'e-mails » du cycle de vie des abonnements. GERIMMO garde toute la logique métier ;
n8n se contente d'orchestrer l'envoi d'e-mails de relance. Reprise possible sans altérer les données d'abonnement.

## Architecture (modèle « tirage » / pull)

1. L'app enregistre les événements dans la table `automation_events` (statut `pending`).
   Sources : `stripe-service.ts` (webhooks Stripe), `business-service.ts`, `admin-functional-service.ts`.
2. n8n interroge périodiquement l'endpoint app **`POST /api/automations/business`**, authentifié par l'en-tête
   `x-gerimmo-automation-secret` = `N8N_BUSINESS_WEBHOOK_SECRET`. Actions supportées :
   - corps `{ "action": "evaluate_lifecycle" }` → exécute la RPC `evaluate_subscription_lifecycle` (suspensions, fins d'essai…).
   - corps vide → renvoie jusqu'à 25 événements `pending` échus.
   - corps `{ "action": "acknowledge", "eventId": "…" }` → marque l'événement `processed`.
3. Pour chaque événement, n8n envoie l'e-mail correspondant via le fournisseur d'e-mails, puis `acknowledge`.

⚠️ **Incohérence à réconcilier avant activation** : les 8 fichiers workflow sont déclenchés par **webhook**
(chemins `gerimmo-*`), ce qui suppose que l'app **pousse** vers n8n. Or l'app ne pousse pas (pas d'appel à
`N8N_BUSINESS_WEBHOOK_URL` dans le code) : elle expose l'endpoint de tirage ci-dessus. Choisir un seul modèle à l'activation :
soit ajouter le push app→n8n, soit remplacer les déclencheurs webhook par un déclencheur planifié (Schedule) qui tire l'endpoint.

## Les 8 workflows (`n8n/workflows/`)

| Fichier | Objet | Chemin webhook |
|---|---|---|
| trial-expiration.json | Fin d'essai | gerimmo-trial-expiration |
| payment-succeeded.json | Paiement accepté | gerimmo-payment-succeeded |
| payment-failed.json | Paiement refusé | gerimmo-payment-failed |
| renewal.json | Renouvellement | gerimmo-renewal |
| suspension.json | Suspension | gerimmo-suspension |
| reactivation.json | Réactivation | gerimmo-reactivation |
| invoice-generated.json | Facture générée | gerimmo-invoice |
| promotion-applied.json | Code promotionnel | gerimmo-promotion |

## Variables et secrets

Côté **app (Vercel)** :
- `N8N_BUSINESS_WEBHOOK_SECRET` — secret partagé avec n8n (obligatoire).
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — pour générer les `automation_events` de paiement.
- `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM` — envoi d'e-mails.

Côté **n8n** :
- `GERIMMO_API_URL` — URL de l'app (ex. domaine Vercel de prod).
- `N8N_BUSINESS_WEBHOOK_SECRET` — même valeur que côté app.
- `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM`.

## Checklist d'activation (le jour venu)

1. [ ] Stripe configuré et webhooks branchés (les `automation_events` se remplissent).
2. [ ] Service d'e-mails configuré (`EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM`).
3. [ ] Définir `N8N_BUSINESS_WEBHOOK_SECRET` (même valeur sur Vercel et n8n).
4. [ ] Importer les 8 JSON dans n8n (Import from File).
5. [ ] Réconcilier le déclencheur (Schedule qui tire l'endpoint, ou push app→n8n) — voir l'incohérence ci-dessus.
6. [ ] Renseigner les variables n8n (`GERIMMO_API_URL`, secret, e-mail).
7. [ ] Tester un événement de bout en bout, puis passer les workflows en `active: true`.
8. [ ] Surveiller `automation_events.status` (`failed`) et la table `business_email_outbox`.
