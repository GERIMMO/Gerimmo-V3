import {
  defaultCommunicationCategories,
  isCommunicationAttachmentAllowed,
  matchesCommunicationSearch,
} from "../src/services/communication-rules.ts";
import assert from "node:assert/strict";
import test from "node:test";

test("active toutes les categories par defaut", () => {
  assert.equal(Object.values(defaultCommunicationCategories).every(Boolean), true);
});

test("accepte les pieces jointes autorisees", () => {
  assert.equal(isCommunicationAttachmentAllowed("application/pdf", 500_000), true);
  assert.equal(isCommunicationAttachmentAllowed("image/jpeg", 10 * 1024 * 1024), true);
});

test("refuse les formats ou tailles interdits", () => {
  assert.equal(isCommunicationAttachmentAllowed("application/zip", 500), false);
  assert.equal(isCommunicationAttachmentAllowed("image/png", 10 * 1024 * 1024 + 1), false);
  assert.equal(isCommunicationAttachmentAllowed("image/png", 0), false);
});

test("recherche dans les notifications et conversations", () => {
  assert.equal(matchesCommunicationSearch(["Incident plomberie", "Salle de bain"], "plomberie"), true);
  assert.equal(matchesCommunicationSearch(["Quittance juillet"], "devis"), false);
});
