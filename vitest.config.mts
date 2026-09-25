import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // Resolve the tsconfig "@/*" alias that app/ routes and layouts import through.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["**/*.test.{ts,tsx}"],
    // Extend (not replace) the defaults so nested node_modules and .git stay excluded.
    exclude: [...configDefaults.exclude, ".next/**"],
  },
});
