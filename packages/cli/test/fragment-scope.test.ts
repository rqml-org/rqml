import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCheck } from "../src/commands/check.js";
import { runLink } from "../src/commands/link.js";
import { EXIT } from "../src/runtime.js";

/**
 * REQ-CORE-DRIFT-SCOPE at the gate. The core tests cover which status a change
 * earns; what matters here is the consequence — whether the build stops — and
 * the release papercut this exists to remove: bumping `version` in a manifest
 * whose linked evidence is `#bin`.
 */

const SPEC = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.2.0" version="2.2.0" docId="SCOPECLI-1" status="draft">
  <meta><title>t</title><system>s</system></meta>
  <goals><goal id="G1" title="g"><statement>s</statement></goal></goals>
  <requirements>
    <req id="REQ-BIN" type="FR" title="r" status="approved"><statement>s</statement></req>
  </requirements>
  <trace>
    <edge id="E-SAT" type="satisfies" from="REQ-BIN" to="G1"/>
  </trace>
</rqml>`;

const MANIFEST = { name: "demo", version: "1.0.0", bin: { rqml: "dist/cli.js" } };

describe("fragment-scoped drift at the gate (REQ-CORE-DRIFT-SCOPE)", () => {
  let dir: string;
  let out: string[];
  let restore: () => void;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rqml-cli-scope-"));
    writeFileSync(join(dir, "requirements.rqml"), SPEC);
    mkdirSync(join(dir, "pkg"));
    writeManifest(MANIFEST);

    out = [];
    const write = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string) => {
      out.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    restore = () => {
      process.stdout.write = write;
    };
  });
  afterEach(() => {
    restore();
    rmSync(dir, { recursive: true, force: true });
  });

  const writeManifest = (manifest: unknown) =>
    writeFileSync(
      join(dir, "pkg", "package.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );

  const link = () => runLink(["REQ-BIN", "pkg/package.json#bin", "--base-dir", dir]);
  const check = (...extra: string[]) => runCheck(["--base-dir", dir, ...extra]);
  const report = () =>
    JSON.parse(out.join("")) as {
      verdict: string;
      drift: unknown[];
      contextChanged: unknown[];
    };

  it("records fragment scope when linking, and says so", async () => {
    expect(await link()).toBe(EXIT.OK);
    const baseline = JSON.parse(
      readFileSync(join(dir, ".rqml", "baseline.json"), "utf8"),
    ) as Record<string, string>;
    expect(baseline["E-IMPL-BIN"]).toMatch(/^f1:[0-9a-f]{64}:[0-9a-f]{64}$/);

    out.length = 0;
    expect(await runLink(["--refresh", "E-IMPL-BIN", "--base-dir", dir])).toBe(EXIT.OK);
    expect(out.join("")).toContain("scoped to #bin");
  });

  it("a version bump beside the evidence is advisory, and the gate stays green", async () => {
    await link();
    writeManifest({ ...MANIFEST, version: "1.0.1" });

    out.length = 0;
    expect(await check("--json")).toBe(EXIT.OK);
    const json = report();
    expect(json.drift).toEqual([]);
    expect(json.contextChanged).toHaveLength(1);
    expect(json.verdict).toBe("pass");
  });

  it("but a change to the evidence itself still stops the build", async () => {
    await link();
    writeManifest({ ...MANIFEST, bin: { rqml: "dist/renamed.js" } });

    out.length = 0;
    expect(await check("--json")).toBe(EXIT.CHECK);
    expect(report().drift).toHaveLength(1);
  });

  it("certified reads the whole file as the evidence and blocks", async () => {
    await link();
    writeManifest({ ...MANIFEST, version: "1.0.1" });
    expect(await check("--strictness", "certified")).toBe(EXIT.CHECK);
  });
});
