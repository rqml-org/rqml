import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const CLI = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

describe("rqml --version", () => {
  it("reports the package.json version (no hardcoded constant to go stale)", () => {
    const out = execFileSync(process.execPath, [CLI, "--version"], {
      encoding: "utf8",
    });
    expect(out.trim()).toBe(pkg.version);
  });
});
