import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Run tests from the backend directory
    root: ".",
    // Use the same path alias as tsconfig.json so imports like
    // "@/lib/nutrition" resolve in tests the same way they do at runtime.
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
