import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrate } from "../src/commands/migrate.js";
import { EXIT, UsageError } from "../src/runtime.js";

/**
 * REQ-CLI-SAFE-INVOCATION. Driven through the real binary, because the defect
 * lived in the entry point's dispatch: `-h`/`--help` was only recognized in the
 * command position, so `rqml migrate --help` reached a command that takes no
 * required positional, discovered a spec, and rewrote it in place.
 */

const CLI = fileURLToPath(new URL("../dist/index.js", import.meta.url));

/** A 2.1.0 spec — migrate would rewrite this one, so any write is visible. */
const SPEC_210 = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="SAFE-1" status="draft">
  <meta><title>t</title><system>s</system></meta>
  <goals><goal id="G1" title="g"><statement>s</statement></goal></goals>
  <requirements>
    <req id="REQ-A" type="FR" title="r" status="approved"><statement>s</statement></req>
  </requirements>
  <trace>
    <edge id="E-SAT" type="satisfies">
      <from><locator><local id="REQ-A"/></locator></from>
      <to><locator><local id="G1"/></locator></to>
    </edge>
  </trace>
</rqml>`;

describe("help and unrecognized input never mutate (REQ-CLI-SAFE-INVOCATION)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rqml-safe-"));
    writeFileSync(join(dir, "requirements.rqml"), SPEC_210);
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const spec = (): string => readFileSync(join(dir, "requirements.rqml"), "utf8");

  /** Run the real CLI in the temp project; returns stdout and the exit status. */
  function run(args: string[]): { out: string; status: number } {
    try {
      const out = execFileSync(process.execPath, [CLI, ...args], {
        cwd: dir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return { out, status: 0 };
    } catch (error) {
      const e = error as { stdout?: string; status?: number };
      return { out: e.stdout ?? "", status: e.status ?? 1 };
    }
  }

  for (const flag of ["--help", "-h"]) {
    it(`\`migrate ${flag}\` prints usage and leaves the spec untouched (CRIT-CLI-HELP-NOWRITE)`, () => {
      const before = spec();
      const { out, status } = run(["migrate", flag]);
      expect(status).toBe(EXIT.OK);
      expect(out).toContain("Usage:");
      expect(out).toContain("migrate");
      // The regression: this used to silently rewrite the spec to 2.2.0.
      expect(spec()).toBe(before);
      expect(spec()).toContain('version="2.1.0"');
    });
  }

  it("the guard holds for other commands too, not just migrate", () => {
    for (const cmd of ["check", "validate", "status", "link"]) {
      const before = spec();
      const { out, status } = run([cmd, "--help"]);
      expect(status, `${cmd} --help should exit OK`).toBe(EXIT.OK);
      expect(out, `${cmd} --help should print usage`).toContain("Usage:");
      expect(spec(), `${cmd} --help must not touch the spec`).toBe(before);
    }
  });

  it("`migrate --bogus` refuses instead of writing (CRIT-CLI-UNKNOWN-FLAG)", () => {
    const before = spec();
    const { status } = run(["migrate", "--bogus"]);
    expect(status).toBe(EXIT.USAGE);
    expect(spec()).toBe(before);
  });

  it("runMigrate rejects unknown flags at the command boundary", async () => {
    await expect(
      runMigrate(["--bogus", "--spec", join(dir, "requirements.rqml")]),
    ).rejects.toThrow(UsageError);
    // …while the options it does understand still work.
    expect(
      await runMigrate(["--dry-run", "--spec", join(dir, "requirements.rqml")]),
    ).toBe(EXIT.OK);
    expect(spec()).toContain('version="2.1.0"'); // --dry-run wrote nothing
  });

  it("a real migrate still works, so the guards did not disable the command", () => {
    const { status } = run(["migrate"]);
    expect(status).toBe(EXIT.OK);
    expect(spec()).toContain('version="2.2.0"');
  });
});
