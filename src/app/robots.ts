import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://next-js-and-shadcn-ui-admin-dashboard-gerimmo.vercel.app";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/tarifs", "/demonstration", "/aide", "/demarrer", "/contact", "/pourquoi-gerimmo"],
      disallow: ["/dashboard/", "/api/", "/auth/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
