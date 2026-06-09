import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeBaseline,
  detectDrift,
  implementsLinks,
  loadBaseline,
  saveBaseline,
} from "../src/check/drift.js";
import type { RqmlDocument } from "../src/model/types.js";
import { parse } from "../src/parse/parse.js";

// Two implements links: one to code that exists, one to code that is gone.
const DOC = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="DRIFTTEST-1" status="draft">
  <meta>
    <title>Drift fixture</title>
    <system>drifttest</system>
  </meta>
  <requirements>
    <req id="REQ-1" type="FR" title="Present" priority="must" status="approved">
      <statement>R1 SHALL work.</statement>
    </req>
    <req id="REQ-2" type="FR" title="Drifted" priority="must" status="approved">
      <statement>R2 SHALL work.</statement>
    </req>
  </requirements>
  <trace>
    <edge id="E-IMPL-OK" type="implements">
      <from><locator><external uri="file:src/present.ts"/></locator></from>
      <to><locator><local id="REQ-1"/></locator></to>
    </edge>
    <edge id="E-IMPL-GONE" type="implements">
      <from><locator><external uri="file:src/gone.ts#doThing"/></locator></from>
      <to><locator><local id="REQ-2"/></locator></to>
    </edge>
  </trace>
</rqml>`;

function doc(): RqmlDocument {
  const r = parse(DOC);
  if (!r.ok) throw new Error(`fixture failed to parse: ${r.error.message}`);
  return r.document;
}

describe("implementsLinks", () => {
  it("extracts implements edges with their external code URI and requirement", () => {
    const links = implementsLinks(doc());
    expect(links).toEqual([
      { edgeId: "E-IMPL-GONE", uri: "file:src/gone.ts#doThing", requirementId: "REQ-2" },
      { edgeId: "E-IMPL-OK", uri: "file:src/present.ts", requirementId: "REQ-1" },
    ]);
  });
});

describe("detectDrift", () => {
  it("reports links whose artifact is missing, via an injected resolver", () => {
    const report = detectDrift(doc(), {
      resolve: (link) => (link.uri.includes("gone.ts") ? "missing" : "present"),
    });
    expect(report.drifted.map((d) => d.edgeId)).toEqual(["E-IMPL-GONE"]);
    expect(report.drifted[0]?.status).toBe("missing");
    expect(report.diagnostics[0]?.source).toBe("drift");
    expect(report.diagnostics[0]?.rule).toBe("missing-implementation");
  });

  it("treats changed artifacts as drift too", () => {
    const report = detectDrift(doc(), { resolve: () => "changed" });
    expect(report.drifted).toHaveLength(2);
    expect(report.diagnostics.every((d) => d.rule === "changed-implementation")).toBe(
      true,
    );
  });

  it("is clean when every artifact resolves", () => {
    const report = detectDrift(doc(), { resolve: () => "present" });
    expect(report.drifted).toEqual([]);
    expect(report.diagnostics).toEqual([]);
  });

  it("default filesystem resolver detects a missing file under baseDir", () => {
    const report = detectDrift(doc(), { baseDir: "/nonexistent-base-xyz" });
    // Both files are missing under a non-existent base ⇒ both drift.
    expect(report.drifted.map((d) => d.edgeId).sort()).toEqual([
      "E-IMPL-GONE",
      "E-IMPL-OK",
    ]);
  });
});

describe("drift baselines (REQ-CORE-DRIFT-BASELINE)", () => {
  /** A temp project with both linked files present. */
  function project(): string {
    const baseDir = mkdtempSync(join(tmpdir(), "rqml-baseline-"));
    mkdirSync(join(baseDir, "src"));
    writeFileSync(join(baseDir, "src", "present.ts"), "export const a = 1;\n");
    writeFileSync(join(baseDir, "src", "gone.ts"), "export const b = 2;\n");
    return baseDir;
  }

  it("computeBaseline hashes every resolvable implements link", () => {
    const baseDir = project();
    const baseline = computeBaseline(doc(), { baseDir });
    expect(Object.keys(baseline).sort()).toEqual(["E-IMPL-GONE", "E-IMPL-OK"]);
    for (const hash of Object.values(baseline)) {
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("reports changed when an artifact no longer matches its recorded hash", () => {
    const baseDir = project();
    const baseline = computeBaseline(doc(), { baseDir });
    writeFileSync(join(baseDir, "src", "present.ts"), "export const a = 999;\n");
    const report = detectDrift(doc(), { baseDir, baseline });
    expect(report.drifted.map((d) => d.edgeId)).toEqual(["E-IMPL-OK"]);
    expect(report.drifted[0]?.status).toBe("changed");
    expect(report.diagnostics[0]?.rule).toBe("changed-implementation");
  });

  it("is clean when artifacts match the baseline", () => {
    const baseDir = project();
    const baseline = computeBaseline(doc(), { baseDir });
    expect(detectDrift(doc(), { baseDir, baseline }).drifted).toEqual([]);
  });

  it("still reports missing files when a baseline is supplied", () => {
    const baseDir = project();
    const baseline = computeBaseline(doc(), { baseDir });
    // Resolve against an empty base: existence failure must win over hashes.
    const report = detectDrift(doc(), { baseDir: "/nonexistent-base-xyz", baseline });
    expect(report.drifted).toHaveLength(2);
    expect(report.drifted.every((d) => d.status === "missing")).toBe(true);
  });

  it("save/load round-trips with sorted keys", () => {
    const baseDir = project();
    const baseline = { "E-Z": "ff".repeat(32), "E-A": "aa".repeat(32) };
    saveBaseline(baseDir, baseline);
    expect(loadBaseline(baseDir)).toEqual(baseline);
  });

  it("loadBaseline returns undefined when no store exists", () => {
    expect(loadBaseline("/nonexistent-base-xyz")).toBeUndefined();
  });
});
