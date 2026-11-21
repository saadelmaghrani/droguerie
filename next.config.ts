import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  experimental: {
    serverActions: {
      // Envoi de photos : 8 Mo par fichier (src/lib/media.ts) + enveloppe de la requête.
      // Le proxy (/admin) garde au plus 10 Mo en mémoire (proxyClientMaxBodySize par défaut).
      bodySizeLimit: "9mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
