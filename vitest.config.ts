import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)), "server-only": fileURLToPath(new URL("./tests/vide.ts", import.meta.url)) } },
  test: {
    environment: "node",
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      CHIFFREMENT_CLE: Buffer.alloc(32, 7).toString("base64"),
      BETTER_AUTH_SECRET: "secret-de-test-secret-de-test-secret-de-test",
      BETTER_AUTH_URL: "http://localhost:3000",
      N8N_JETON: "jeton-n8n-de-test-jeton-n8n-de-test-0001",
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? "",
    },
  },
});
