import type { ReactNode } from "react";

import type { Metadata } from "next";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_CONFIG } from "@/config/app-config";
import { fontVars } from "@/lib/fonts/registry";
import { PREFERENCE_DEFAULTS } from "@/lib/preferences/preferences-config";
import { AuthProvider } from "@/providers/auth-provider";
import { ThemeBootScript } from "@/scripts/theme-boot";
import { PreferencesStoreProvider } from "@/stores/preferences/preferences-provider";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://next-js-and-shadcn-ui-admin-dashboard-gerimmo.vercel.app",
  ),
  title: { default: APP_CONFIG.meta.title, template: "%s | GERIMMO" },
  description: APP_CONFIG.meta.description,
  applicationName: "GERIMMO",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "GERIMMO",
    title: "GERIMMO — La gestion immobilière, enfin simple",
    description: "Biens, incidents, documents et interventions dans une plateforme française sécurisée.",
    images: [
      {
        url: "/marketing/gerimmo-agency-hero.png",
        width: 1680,
        height: 945,
        alt: "GERIMMO pour les professionnels de l’immobilier",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GERIMMO",
    description: "La gestion immobilière, enfin simple.",
    images: ["/marketing/gerimmo-agency-hero.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { theme_mode, theme_preset, content_layout, navbar_style, sidebar_variant, sidebar_collapsible, font } =
    PREFERENCE_DEFAULTS;
  return (
    <html
      lang="fr"
      data-theme-mode={theme_mode}
      data-theme-preset={theme_preset}
      data-content-layout={content_layout}
      data-navbar-style={navbar_style}
      data-sidebar-variant={sidebar_variant}
      data-sidebar-collapsible={sidebar_collapsible}
      data-font={font}
      suppressHydrationWarning
    >
      <head>
        {/* Applies theme and layout preferences on load to avoid flicker and unnecessary server rerenders. */}
        <ThemeBootScript />
      </head>
      <body className={`${fontVars} min-h-screen antialiased`}>
        <TooltipProvider>
          <PreferencesStoreProvider initialValues={PREFERENCE_DEFAULTS}>
            <AuthProvider>
              {children}
              <Toaster />
            </AuthProvider>
          </PreferencesStoreProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
