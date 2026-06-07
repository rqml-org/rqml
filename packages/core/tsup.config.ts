import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "validate/index": "src/validate/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
  sourcemap: true,
  target: "es2022",
  // Bundle @rqml/schema so its inlined XSD text ships inside @rqml/core,
  // keeping validation self-contained and offline (REQ-CORE-VALIDATE,
  // REQ-CLI-OFFLINE) without a runtime dependency on the schema package.
  noExternal: ["@rqml/schema"],
});
