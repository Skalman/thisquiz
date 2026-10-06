import { defineConfig } from "@playwright/test";

const PORT = 4174;

/** `pnpm screenshots`: regenerates the store and link-preview images in public/. */
export default defineConfig({
  testDir: "./scripts/screenshots",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    serviceWorkers: "block",
    reducedMotion: "reduce",
    colorScheme: "light",
  },
  webServer: {
    command: `pnpm preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
  },
});
