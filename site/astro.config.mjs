import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://point-grab.com",
  prefetch: true,
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      // These appear only inside code-sample template literals on the
      // install/docs pages — they should never be resolved by Vite.
      exclude: [
        "@point-grab/core",
        "@point-grab/angular",
        "@point-grab/react",
        "@point-grab/svelte",
        "@point-grab/vue",
        "@point-grab/web-components",
      ],
    },
  },
});
