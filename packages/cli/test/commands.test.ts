import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCheck } from "../src/commands/check.js";
import { runImpact } from "../src/commands/impact.js";
import { runLink } from "../src/commands/link.js";
import { runShow } from "../src/commands/show.js";
import { runSkeleton } from "../src/commands/skeleton.js";
import { EXIT, UsageError } from "../src/runtime.js";

const SPEC = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="CLITEST-1" status="draft">
  <meta><title>t</title><system>s</system></meta>
  <goals>
    <goal id="G1" title="g"><statement>s</statement></goal>
  </goals>
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

describe("loop commands", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rqml-cli-cmd-"));
    writeFileSync(join(dir, "requirements.rqml"), SPEC);
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src", "a.ts"), "export const a = 1;\n");
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("link appends a validated edge and records the baseline (CRIT-LINK-ROUNDTRIP)", async () => {
    const code = await runLink(["REQ-A", "src/a.ts", "--base-dir", dir]);
    expect(code).toBe(EXIT.OK);

    const spec = readFileSync(join(dir, "requirements.rqml"), "utf8");
    expect(spec).toContain('<edge id="E-IMPL-A" type="implements">');
    expect(spec).toContain('<external uri="src/a.ts" kind="code"/>');

    const baseline = JSON.parse(
      readFileSync(join(dir, ".rqml", "baseline.json"), "utf8"),
    ) as Record<string, string>;
    expect(Object.keys(baseline)).toEqual(["E-IMPL-A"]);
    expect(baseline["E-IMPL-A"]).toMatch(/^[0-9a-f]{64}$/);

    // The check gate stays green right after linking…
    expect(await runCheck(["--base-dir", dir])).toBe(EXIT.OK);
  });

  it("check reports changed artifacts after linking (CRIT-DRIFT-CHANGED)", async () => {
    await runLink(["REQ-A", "src/a.ts", "--base-dir", dir]);
    writeFileSync(join(dir, "src", "a.ts"), "export const a = 2;\n");
    // …and exits non-zero once the linked artifact drifts.
    expect(await runCheck(["--base-dir", dir])).toBe(EXIT.CHECK);
  });

  it("link refuses unknown artifacts without touching the spec", async () => {
    const code = await runLink(["REQ-NOPE", "src/a.ts", "--base-dir", dir]);
    expect(code).toBe(EXIT.VALIDATION);
    expect(readFileSync(join(dir, "requirements.rqml"), "utf8")).toBe(SPEC);
  });

  it("link records verifiedBy edges without a baseline entry", async () => {
    writeFileSync(join(dir, "src", "a.test.ts"), "test\n");
    const code = await runLink([
      "REQ-A",
      "src/a.test.ts",
      "--type",
      "verifiedBy",
      "--base-dir",
      dir,
    ]);
    expect(code).toBe(EXIT.OK);
    const spec = readFileSync(join(dir, "requirements.rqml"), "utf8");
    expect(spec).toContain('<edge id="E-VER-A" type="verifiedBy">');
  });

  it("show extracts a known artifact and rejects an unknown id", async () => {
    expect(await runShow(["REQ-A", "--base-dir", dir])).toBe(EXIT.OK);
    expect(await runShow(["NOPE", "--base-dir", dir])).toBe(EXIT.USAGE);
  });

  it("impact answers for a known artifact and rejects an unknown id", async () => {
    expect(await runImpact(["G1", "--base-dir", dir])).toBe(EXIT.OK);
    expect(await runImpact(["NOPE", "--base-dir", dir])).toBe(EXIT.USAGE);
  });

  it("skeleton prints snippets and rejects unknown kinds", async () => {
    expect(await runSkeleton(["req"])).toBe(EXIT.OK);
    await expect(runSkeleton(["nope"])).rejects.toThrow(UsageError);
  });
});
