import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Développement uniquement : autorise l'ouverture du site depuis un téléphone sur le même Wi-Fi
  // (http://<adresse-du-Mac>:3000). Sans effet en production.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*", "*.local"],
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  experimental: {
    // Développement uniquement : pas de cache Turbopack sur disque (.next/dev/cache).
    // Next 16.4.6 : relancer `next dev` avec d'autres variables d'environnement (ex. base de test)
    // sur ce cache provoque une boucle de rechargement (ordre HMR « restart » à chaque connexion).
    // Coût : premier affichage de chaque page un peu plus lent après un redémarrage. Sans effet sur le build.
    turbopackFileSystemCacheForDev: false,
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
