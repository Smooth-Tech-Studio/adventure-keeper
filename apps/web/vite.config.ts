import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

// `pnpm dev:https` sets DEV_HTTPS=1 to serve the dev server over HTTPS with a
// self-signed cert (secure-context features: WebAuthn, service workers, …).
const useHttps = Boolean(process.env.DEV_HTTPS);
// `pnpm dev:expose` sets DEV_EXPOSE=1 to listen on the local network too, to
// try the app from a phone (its emulators then listen on 0.0.0.0 as well).
const expose = Boolean(process.env.DEV_EXPOSE);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), ...(useHttps ? [basicSsl()] : [])],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  // Workspace packages are pure ESM source — let Vite serve them directly
  // instead of esbuild pre-bundling, which mishandles the cross-package
  // `export *` re-export chain (schemas → system-dnd2024 → locale).
  optimizeDeps: {
    exclude: [
      "@adventure-keeper/locale",
      "@adventure-keeper/schemas",
      "@adventure-keeper/system-dnd2024",
    ],
  },
  server: {
    port: 5173,
    host: expose || undefined,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        // Vendor chunks, by module path (pnpm keeps each under `node_modules/<name>/`).
        codeSplitting: {
          groups: [
            { name: "firebase", test: /[\\/]node_modules[\\/](@firebase|firebase)[\\/]/ },
            {
              name: "react",
              test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
            },
            // One chunk: the schemas import the engine, both import zod — split
            // apart, the chunks would import each other and fail to initialise.
            {
              name: "rules",
              // The SRD catalogues (spells, equipment) stay chunks of their own, loaded on demand.
              test: /[\\/]packages[\\/](locale|schemas|system-dnd2024)[\\/](?!.*[\\/]srd[\\/](spells|weapons|armors|tools|gear|equipment-packs)\.json)|[\\/]node_modules[\\/]zod[\\/]/,
            },
            {
              name: "i18n",
              test: /[\\/]node_modules[\\/](i18next|react-i18next|i18next-browser-languagedetector)[\\/]/,
            },
            { name: "radix", test: /[\\/]node_modules[\\/]@radix-ui[\\/]/ },
          ],
        },
      },
    },
  },
});
