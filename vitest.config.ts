import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "packages/**/src/**/*.test.ts",
      "apps/api/src/**/*.test.ts",
      "src/lib/**/*.test.ts",
    ],
    passWithNoTests: true,
  },
});
