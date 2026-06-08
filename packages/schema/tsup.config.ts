import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
  sourcemap: true,
  target: "es2022",
  // Inline schema and template assets as default-exported text.
  loader: { ".xsd": "text", ".md": "text" },
});
