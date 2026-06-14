import { describe, expect, it } from "vitest";
import { buildMatrix, matrixToMarkdown } from "../src/analyze/matrix.js";
import type { RqmlDocument } from "../src/model/types.js";
import { parse } from "../src/parse/parse.js";

// REQ-1: approved, satisfies GOAL-A, verified by TC-1, implemented by code.
// REQ-2: draft orphan — satisfies nothing, unverified, unimplemented.
const DOC = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="MATTEST-1" status="draft">
  <meta>
    <title>Matrix fixture</title>
    <system>mattest</system>
  </meta>
  <goals>
    <goal id="GOAL-A" title="Covered goal" priority="must"><statement>A.</statement></goal>
  </goals>
  <requirements>
    <req id="REQ-1" type="FR" title="Covered" priority="must" status="approved">
      <statement>R1 SHALL work.</statement>
    </req>
    <req id="REQ-2" type="FR" title="Orphan" priority="should" status="draft">
      <statement>R2 SHOULD work.</statement>
    </req>
  </requirements>
  <verification>
    <testCase id="TC-1" type="unit" title="t"><steps>run</steps><expected>ok</expected></testCase>
  </verification>
  <trace>
    <edge id="E-SAT" type="satisfies">
      <from><locator><local id="REQ-1"/></locator></from>
      <to><locator><local id="GOAL-A"/></locator></to>
    </edge>
    <edge id="E-VER" type="verifiedBy">
      <from><locator><local id="REQ-1"/></locator></from>
      <to><locator><local id="TC-1"/></locator></to>
    </edge>
    <edge id="E-IMPL" type="implements">
      <from><locator><external uri="src/index.ts" kind="code"/></locator></from>
      <to><locator><local id="REQ-1"/></locator></to>
    </edge>
  </trace>
</rqml>`;

function doc(xml = DOC): RqmlDocument {
  const r = parse(xml);
  if (!r.ok) throw new Error(`fixture failed to parse: ${r.error.message}`);
  return r.document;
}

describe("buildMatrix (REQ-CORE-MATRIX)", () => {
  it("emits one row per requirement in sorted order", () => {
    expect(buildMatrix(doc()).rows.map((r) => r.id)).toEqual(["REQ-1", "REQ-2"]);
  });

  it("derives status, refs, and titles for a covered requirement (CRIT-MATRIX-DERIVED)", () => {
    const r1 = buildMatrix(doc()).rows.find((r) => r.id === "REQ-1");
    expect(r1?.verification).toBe("verified");
    expect(r1?.implementation).toBe("implemented");
    expect(r1?.goals).toEqual([{ id: "GOAL-A", title: "Covered goal" }]);
    expect(r1?.tests).toEqual([{ id: "TC-1", title: "t" }]);
    expect(r1?.implementations).toEqual([{ id: "src/index.ts", external: true }]);
    expect(r1?.warnings).toEqual([]);
  });

  it("flags an unverified, unimplemented orphan", () => {
    const r2 = buildMatrix(doc()).rows.find((r) => r.id === "REQ-2");
    expect(r2?.verification).toBe("unverified");
    expect(r2?.implementation).toBe("unimplemented");
    expect([...(r2?.warnings ?? [])].sort()).toEqual([
      "orphan",
      "unimplemented",
      "unverified",
    ]);
  });

  it("counts the included rows in the summary", () => {
    const s = buildMatrix(doc()).summary;
    expect(s).toEqual({
      total: 2,
      verified: 1,
      unverified: 1,
      implemented: 1,
      unimplemented: 1,
      premature: 0,
      orphans: 1,
      brokenTraces: 0,
    });
  });

  it("filters to requirements lacking verification (CRIT-MATRIX-SURFACE)", () => {
    const m = buildMatrix(doc(), { warning: ["unverified"] });
    expect(m.rows.map((r) => r.id)).toEqual(["REQ-2"]);
    expect(m.summary.total).toBe(1);
  });

  it("is deterministic across runs", () => {
    expect(buildMatrix(doc())).toEqual(buildMatrix(doc()));
  });

  it("marks an implements edge to a non-approved requirement as premature", () => {
    const premature = DOC.replace(
      "  </trace>",
      `  <edge id="E-IMPL-EARLY" type="implements">
      <from><locator><external uri="src/early.ts" kind="code"/></locator></from>
      <to><locator><local id="REQ-2"/></locator></to>
    </edge>
  </trace>`,
    );
    const r2 = buildMatrix(doc(premature)).rows.find((r) => r.id === "REQ-2");
    expect(r2?.implementation).toBe("premature");
    expect(r2?.warnings).toContain("premature");
  });

  it("flags a dangling local reference as a broken trace", () => {
    const broken = DOC.replace(
      '<to><locator><local id="GOAL-A"/></locator></to>',
      '<to><locator><local id="GOAL-MISSING"/></locator></to>',
    );
    const r1 = buildMatrix(doc(broken)).rows.find((r) => r.id === "REQ-1");
    expect(r1?.goals).toEqual([{ id: "GOAL-MISSING", broken: true }]);
    expect(r1?.warnings).toContain("broken-trace");
  });
});

describe("matrixToMarkdown", () => {
  it("renders a table with a header and a row per requirement", () => {
    const md = matrixToMarkdown(buildMatrix(doc()));
    expect(md).toContain("| ID | Title | Type | Status |");
    expect(md).toContain("| REQ-1 |");
    expect(md).toContain("Traceability matrix");
  });
});
