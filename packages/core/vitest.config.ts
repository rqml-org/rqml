import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Load *.xsd and *.md imports as default-exported text, mirroring the tsup loader. */
function textFiles() {
  return {
    name: "rqml-text-files",
    load(id: string) {
      const path = id.split("?")[0];
      if (path === undefined) return null;
      if (!path.endsWith(".xsd") && !path.endsWith(".md")) return null;
      return `export default ${JSON.stringify(readFileSync(path, "utf8"))};`;
    },
  };
}

export default defineConfig({
  plugins: [textFiles()],
  resolve: {
    alias: {
      // Run tests against @rqml/schema source so a prior schema build is not required.
      "@rqml/schema": fileURLToPath(new URL("../schema/src/index.ts", import.meta.url)),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
