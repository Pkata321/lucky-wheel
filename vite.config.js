import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
  },
  build: {
    rollupOptions: {
      input: {
        player: resolve(import.meta.dirname, "index.html"),
        admin: resolve(import.meta.dirname, "admin.html"),
        winners: resolve(import.meta.dirname, "winners.html"),
        test: resolve(import.meta.dirname, "test.html"),
      },
    },
  },
});
