import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://next-js-and-shadcn-ui-admin-dashboard-gerimmo.vercel.app";
  return ["", "/pourquoi-gerimmo", "/tarifs", "/demonstration", "/aide", "/demarrer", "/contact"].map(
    (path, index) => ({
      url: `${base}${path}`,
      lastModified: new Date(),
      changeFrequency: index === 0 ? "weekly" : "monthly",
      priority: index === 0 ? 1 : 0.8,
    }),
  );
}
