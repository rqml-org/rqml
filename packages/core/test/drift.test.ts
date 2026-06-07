import { describe, expect, it } from "vitest";
import { detectDrift, implementsLinks } from "../src/check/drift.js";
import { parse } from "../src/parse/parse.js";
import type { RqmlDocument } from "../src/model/types.js";

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
    expect(report.diagnostics.every((d) => d.rule === "changed-implementation")).toBe(true);
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
