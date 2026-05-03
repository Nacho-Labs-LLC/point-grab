import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://point-grab.com",
  prefetch: true,
  vite: {
    plugins: [tailwindcss()],
  },
});
