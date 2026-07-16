/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["exceljs"],
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async redirects() {
    return [
      {
        source: "/dashboard/super-admin",
        destination: "/admin",
        permanent: false,
      },
      {
        source: "/dashboard/super-admin/imports",
        destination: "/admin/imports",
        permanent: false,
      },
      {
        source: "/dashboard/super-admin/articles",
        destination: "/admin/articles",
        permanent: false,
      },
      {
        source: "/dashboard/super-admin/business",
        destination: "/admin/subscriptions",
        permanent: false,
      },
      {
        source: "/dashboard/super-admin/qualite",
        destination: "/admin/bugs",
        permanent: false,
      },
      {
        source: "/dashboard/super-admin/marketing",
        destination: "/admin/marketing",
        permanent: false,
      },
      {
        source: "/dashboard/super-admin/telegram",
        destination: "/admin/integrations",
        permanent: false,
      },
      {
        source: "/dashboard",
        destination: "/dashboard/accueil",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
