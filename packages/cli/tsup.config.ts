import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: false,
  clean: true,
  treeshake: true,
  sourcemap: true,
  target: "es2022",
  // The CLI bundles the engine so the published binary is self-contained.
  noExternal: ["@rqml/core", "@rqml/schema"],
});
