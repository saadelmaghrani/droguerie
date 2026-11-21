// Tests unitaires (logique pure : conversion de numéros, règles métier…).
// Lancer : npm test
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Les modules serveur importent "server-only" : neutralisé pour les tests (pas de Next.js ici).
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000, // le test de détourage charge un modèle de 170 Mo
  },
});
