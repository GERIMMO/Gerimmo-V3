import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("la navigation Super Admin est centralisee et complete", async () => {
  const navigation = await source("src/navigation/admin/admin-navigation.ts");
  const groups = [
    "Pilotage",
    "Réseau GERIMMO",
    "Gestion opérationnelle",
    "Business",
    "Qualité et support",
    "Système",
    "Configuration",
  ];
  const priorityEntries = ["Vue d’ensemble", "À traiter", "Agences", "Incidents", "Bugs signalés"];

  for (const group of groups) assert.match(navigation, new RegExp(`title: "${group}"`));
  for (const entry of priorityEntries) assert.match(navigation, new RegExp(`title: "${entry}"`));
  assert.match(navigation, /overview: "\/admin"/);
  assert.match(navigation, /administrators: "\/admin\/administrators"/);

  const routeBlock = navigation.split("} as const;")[0] ?? "";
  const routes = [...routeBlock.matchAll(/"(\/admin[^"]*)"/g)].map((match) => match[1]);
  assert.equal(routes.length, 36);
  assert.equal(new Set(routes).size, routes.length);
});

test("les routes admin sont protegees sur le serveur et dans le middleware", async () => {
  const [layout, guards, middleware] = await Promise.all([
    source("src/app/(main)/admin/layout.tsx"),
    source("src/lib/auth/guards.ts"),
    source("src/lib/supabase/middleware.ts"),
  ]);

  assert.match(layout, /requireSuperAdminPage\(\)/);
  assert.match(guards, /profile\?\.is_super_admin/);
  assert.match(guards, /redirect\("\/unauthorized"\)/);
  assert.match(middleware, /pathname\.startsWith\("\/admin"\)/);
});

test("les anciens liens Super Admin redirigent vers la nouvelle architecture", async () => {
  const config = await source("next.config.mjs");
  assert.match(config, /source: "\/dashboard\/super-admin"/);
  assert.match(config, /destination: "\/admin"/);
  assert.match(config, /destination: "\/admin\/subscriptions"/);
  assert.match(config, /destination: "\/admin\/integrations"/);
});

test("le panneau Creer ne declenche aucune creation fictive", async () => {
  const createSheet = await source("src/app/(main)/admin/_components/admin-create-sheet.tsx");
  assert.match(createSheet, /Créer une agence/);
  assert.match(createSheet, /Créer une annonce globale/);
  assert.match(createSheet, /Bientôt disponible/);
  assert.doesNotMatch(createSheet, /\.insert\(|fetch\(/);
});

test("le menu agence ne contient plus le centre Super Admin ni les actions factices", async () => {
  const [sidebar, navMain] = await Promise.all([
    source("src/navigation/sidebar/sidebar-items.ts"),
    source("src/app/(main)/dashboard/_components/sidebar/nav-main.tsx"),
  ]);
  assert.doesNotMatch(sidebar, /dashboard\/super-admin/);
  assert.doesNotMatch(navMain, /Quick Create|Inbox/);
});

test("toutes les vues nationales utilisent des donnees reelles", async () => {
  const [route, service, view] = await Promise.all([
    source("src/app/(main)/admin/[section]/page.tsx"),
    source("src/services/admin-national-service.ts"),
    source("src/app/(main)/admin/_components/admin-national-view.tsx"),
  ]);
  const sections = [
    "properties",
    "users",
    "incidents",
    "quotes",
    "interventions",
    "contractors",
    "documents",
    "messages",
    "notifications",
    "reports",
    "support",
    "ideas",
    "automations",
    "security",
    "settings",
    "document-templates",
    "roles",
    "administrators",
  ];

  for (const section of sections) assert.match(service, new RegExp(`"${section}"`));
  assert.match(service, /await requireSuperAdmin\(\)/);
  assert.match(route, /getAdminNationalView\(section\)/);
  assert.doesNotMatch(route, /AdminModulePlaceholder|Module en préparation/);
  assert.match(view, /Données réelles enregistrées dans Supabase/);
  assert.match(view, /SheetContent/);
  assert.doesNotMatch(`${service}\n${view}`, /org-demo|mockData|fakeData/i);
});

test("les vues nationales sont bornees et n'exposent pas les fichiers documentaires", async () => {
  const service = await source("src/services/admin-national-service.ts");
  assert.match(service, /const LIMIT = 100/);
  assert.match(service, /\.limit\(LIMIT\)/);
  assert.doesNotMatch(service, /storage_path|file_path|signed_url|service_role/i);
});
