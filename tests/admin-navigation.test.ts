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
  const groups = ["Centre de commandement", "Réseau GERIMMO", "Business", "Support", "Système"];
  const priorityEntries = ["Vue d’ensemble", "À traiter", "Supervision temps réel", "Agences", "Bugs"];

  for (const group of groups) assert.match(navigation, new RegExp(`title: "${group}"`));
  for (const entry of priorityEntries) assert.match(navigation, new RegExp(`title: "${entry}"`));
  assert.match(navigation, /overview: "\/admin"/);
  assert.match(navigation, /administrators: "\/admin\/administrators"/);

  const routeBlock = navigation.split("} as const;")[0] ?? "";
  const routes = [...routeBlock.matchAll(/"(\/admin[^"]*)"/g)].map((match) => match[1]);
  assert.equal(routes.length, 36);
  assert.equal(new Set(routes).size, routes.length);
});

test("le mode supervision conserve l'identite et le JWT du Super Admin", async () => {
  const [service, route, banner, migration] = await Promise.all([
    source("src/services/supervision-service.ts"),
    source("src/app/api/admin/supervision/route.ts"),
    source("src/app/(main)/dashboard/_components/supervision-banner.tsx"),
    source("supabase/migrations/20260716150000_admin_supervision_center.sql"),
  ]);

  assert.match(route, /requireSuperAdminApi\(\)/);
  assert.match(service, /superAdminProfileId/);
  assert.match(service, /actor_profile_id: active\.superAdminProfileId/);
  assert.match(service, /httpOnly: true/);
  assert.doesNotMatch(`${service}\n${route}`, /signInWith|generateLink|setSession|refreshSession|access_token|jwt/i);
  assert.match(banner, /Mode supervision/i);
  assert.match(banner, /Toutes les actions sont journalisées/);
  assert.match(migration, /admin_supervision_events/);
  assert.match(migration, /public\.is_super_admin\(\)/);
});

test("les contextes imbriques sont controles sur le serveur", async () => {
  const [service, patrimoine, incidents, documents, users] = await Promise.all([
    source("src/services/supervision-service.ts"),
    source("src/services/patrimoine-service.ts"),
    source("src/services/incidents-service.ts"),
    source("src/services/documents-service.ts"),
    source("src/services/utilisateurs-service.ts"),
  ]);

  assert.match(service, /Un propriétaire ne peut ouvrir que ses biens/);
  assert.match(service, /Ce locataire n’occupe pas le bien supervisé/);
  assert.match(service, /assertSupervisionBien/);
  assert.match(service, /assertSupervisionProfile/);
  assert.match(patrimoine, /getSupervisionDataScope/);
  assert.match(incidents, /supervision\.bienIds\.includes\(incident\.bien_id\)/);
  assert.match(documents, /isDocumentInSupervision/);
  assert.match(users, /supervision\.profileIds\.includes\(member\.profile_id\)/);
});

test("les portails supervises reutilisent le dashboard existant", async () => {
  const [layout, sidebar, items, capabilities] = await Promise.all([
    source("src/app/(main)/dashboard/layout.tsx"),
    source("src/app/(main)/dashboard/_components/sidebar/app-sidebar.tsx"),
    source("src/navigation/sidebar/sidebar-items.ts"),
    source("src/lib/auth/portal-capabilities.ts"),
  ]);

  assert.match(layout, /getActiveSupervision/);
  assert.match(layout, /SupervisionBanner/);
  assert.match(layout, /memberTypeToPortalType/);
  assert.match(layout, /portalType=\{portalType\}/);
  assert.match(sidebar, /getSidebarItemsForPortal\(portalType\)/);
  assert.doesNotMatch(layout, /items=\{navigationItems\}/);
  assert.match(items, /getPortalNavigationIds/);
  assert.match(capabilities, /PORTAIL AGENCE/);
  assert.match(capabilities, /PORTAIL LOCATAIRE/);
  assert.match(capabilities, /PORTAIL ARTISAN/);
  assert.match(capabilities, /supervise:property/);
  assert.match(capabilities, /supervise:tenant/);
});

test("les portails directs et supervises partagent la meme matrice de capacites", async () => {
  const [layout, sidebar, navigation, capabilities, supervision] = await Promise.all([
    source("src/app/(main)/dashboard/layout.tsx"),
    source("src/app/(main)/dashboard/_components/sidebar/app-sidebar.tsx"),
    source("src/navigation/sidebar/sidebar-items.ts"),
    source("src/lib/auth/portal-capabilities.ts"),
    source("src/services/supervision-service.ts"),
  ]);

  assert.match(layout, /supervision\?\.current\.type/);
  assert.match(layout, /directPortalType/);
  assert.match(sidebar, /getSidebarItemsForPortal\(portalType\)/);
  assert.match(navigation, /getPortalNavigationIds/);
  assert.match(supervision, /canEnterPortal\(current\.type, target\.type\)/);
  assert.doesNotMatch(capabilities, /password|signInWith|setSession|access_token/i);
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
