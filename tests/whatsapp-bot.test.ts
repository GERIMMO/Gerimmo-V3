import {
  parseWhatsAppEvents,
  verifyWebhookChallenge,
  verifyWhatsAppSignature,
} from "../src/services/bot/whatsapp-parse.ts";
import type { WhatsAppWebhookPayload } from "../src/types/telegram-bot.ts";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

test("le challenge du webhook n'est renvoye que si le verify token correspond", () => {
  assert.equal(verifyWebhookChallenge("subscribe", "secret-token", "1234", "secret-token"), "1234");
  assert.equal(verifyWebhookChallenge("subscribe", "mauvais", "1234", "secret-token"), null);
  assert.equal(verifyWebhookChallenge("subscribe", "secret-token", "1234", undefined), null);
  assert.equal(verifyWebhookChallenge("autre", "secret-token", "1234", "secret-token"), null);
});

test("la signature X-Hub-Signature-256 est validee et rejette toute alteration", () => {
  const secret = "app-secret-meta";
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

  assert.equal(verifyWhatsAppSignature(body, signature, secret), true);
  assert.equal(verifyWhatsAppSignature(`${body} `, signature, secret), false, "corps altere rejete");
  assert.equal(verifyWhatsAppSignature(body, signature, "autre-secret"), false, "mauvais secret rejete");
  assert.equal(verifyWhatsAppSignature(body, null, secret), false, "signature absente rejetee");
  assert.equal(verifyWhatsAppSignature(body, signature, undefined), false, "secret absent rejete");
});

test("un message texte WhatsApp est normalise avec l'expediteur et le contenu", () => {
  const payload: WhatsAppWebhookPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              contacts: [{ profile: { name: "Alex" }, wa_id: "33612345678" }],
              messages: [
                {
                  from: "33612345678",
                  id: "wamid.ABC",
                  timestamp: "1700000000",
                  type: "text",
                  text: { body: "Il y a une fuite" },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const events = parseWhatsAppEvents(payload);
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, "text");
  assert.equal(events[0].waId, "33612345678");
  assert.equal(events[0].contactName, "Alex");
  assert.equal(events[0].text, "Il y a une fuite");
  assert.equal(events[0].messageId, "wamid.ABC");
});

test("un choix de bouton interactif expose son identifiant (equivalent callback)", () => {
  const payload: WhatsAppWebhookPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              messages: [
                {
                  from: "33612345678",
                  id: "wamid.DEF",
                  timestamp: "1700000001",
                  type: "interactive",
                  interactive: {
                    type: "button_reply",
                    button_reply: { id: "menu:declarer_incident", title: "Declarer" },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const [event] = parseWhatsAppEvents(payload);
  assert.equal(event.kind, "button_reply");
  assert.equal(event.callbackData, "menu:declarer_incident");
});

test("les accuses de statut et les objets non-WhatsApp sont ignores", () => {
  const statuses: WhatsAppWebhookPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-1",
        changes: [{ field: "messages", value: { messaging_product: "whatsapp", statuses: [{ status: "delivered" }] } }],
      },
    ],
  };
  assert.equal(parseWhatsAppEvents(statuses).length, 0);
  assert.equal(parseWhatsAppEvents({ object: "page", entry: [] }).length, 0);
});
