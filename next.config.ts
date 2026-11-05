import type { NextConfig } from "next";

// El portal es 100 % autenticado y dinámico (sesión por cookies), por eso no
// se activa cacheComponents: cada página se renderiza por solicitud.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default nextConfig;
