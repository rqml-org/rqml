import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: false,
  clean: true,
  treeshake: true,
  sourcemap: true,
  target: "es2022",
  // Bundle the engine; keep the MCP SDK external as an installed runtime dep.
  noExternal: ["@rqml/core"],
  external: ["@modelcontextprotocol/sdk"],
});
