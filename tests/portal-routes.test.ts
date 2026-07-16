import { canAccessDashboardPath } from "../src/lib/auth/portal-capabilities.ts";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("les routes dashboard sont autorisées selon le portail", () => {
  assert.equal(canAccessDashboardPath("agency", "/dashboard/utilisateurs"), true);
  assert.equal(canAccessDashboardPath("agency", "/dashboard/parametres/telegram"), true);
  assert.equal(canAccessDashboardPath("tenant", "/dashboard/incidents"), true);
  assert.equal(canAccessDashboardPath("tenant", "/dashboard/documents"), true);
  assert.equal(canAccessDashboardPath("tenant", "/dashboard/utilisateurs"), false);
  assert.equal(canAccessDashboardPath("tenant", "/dashboard/biens"), false);
  assert.equal(canAccessDashboardPath("contractor", "/dashboard/a-faire"), true);
  assert.equal(canAccessDashboardPath("contractor", "/dashboard/parametres"), false);
  assert.equal(canAccessDashboardPath("property", "/dashboard/rapports"), true);
  assert.equal(canAccessDashboardPath("property", "/dashboard/abonnement"), false);
});

test("les listes par rôle réutilisent les données réelles", async () => {
  for (const route of ["proprietaires", "locataires", "artisans"]) {
    const source = await readFile(path.join(root, `src/app/(main)/dashboard/${route}/page.tsx`), "utf8");
    assert.match(source, /listUsers/);
    assert.match(source, /UtilisateursModule/);
    assert.doesNotMatch(source, /ModulePlaceholder/);
  }
});

test("les entrées communication ouvrent le bon onglet réel", async () => {
  const exchanges = await readFile(path.join(root, "src/app/(main)/dashboard/echanges/page.tsx"), "utf8");
  const notifications = await readFile(path.join(root, "src/app/(main)/dashboard/notifications/page.tsx"), "utf8");
  assert.match(exchanges, /getCommunicationPayload/);
  assert.match(exchanges, /initialTab="messages"/);
  assert.match(notifications, /getCommunicationPayload/);
  assert.match(notifications, /initialTab="notifications"/);
});

test("le layout transmet un type sérialisable et laisse les icônes dans la sidebar cliente", async () => {
  const layout = await readFile(path.join(root, "src/app/(main)/dashboard/layout.tsx"), "utf8");
  const sidebar = await readFile(
    path.join(root, "src/app/(main)/dashboard/_components/sidebar/app-sidebar.tsx"),
    "utf8",
  );
  assert.match(layout, /portalType=\{portalType\}/);
  assert.doesNotMatch(layout, /items=\{navigationItems\}/);
  assert.match(sidebar, /getSidebarItemsForPortal\(portalType\)/);
});
