import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const INDEX = read("../src/index.ts");
const README = read("../README.md");

/**
 * Command names from the `main()` dispatch switch — the authoritative surface.
 * Excludes `-v`/`-h`/`--version`/`--help` (they start with `-`) and `default`.
 */
const commands = [...INDEX.matchAll(/case "([a-z][a-z-]*)":/g)].map(
  (m) => m[1] as string,
);

describe("the published CLI README tracks the command surface (drift guard)", () => {
  it("derives a non-trivial command set from the dispatch", () => {
    expect(commands).toContain("validate");
    expect(commands).toContain("lint");
    expect(commands.length).toBeGreaterThanOrEqual(12);
  });

  it("lists every dispatched command as a README entry", () => {
    for (const cmd of commands) {
      // A command entry is a list line that *begins* (after indentation) with the
      // command name — so the word appearing inside a description does not count.
      const listed = new RegExp(`^\\s+${cmd}\\b`, "m").test(README);
      expect(listed, `packages/cli/README.md is missing the "${cmd}" command`).toBe(true);
    }
  });
});
