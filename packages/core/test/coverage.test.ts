import { describe, expect, it } from "vitest";
import { computeCoverage } from "../src/check/coverage.js";
import type { RqmlDocument } from "../src/model/types.js";
import { parse } from "../src/parse/parse.js";

// REQ-1 is fully covered (satisfies a goal, verified by a test, implemented).
// REQ-2 is an orphan: it satisfies nothing, is unverified, and unimplemented.
// GOAL-A is covered by REQ-1; GOAL-B has no satisfying requirement.
const DOC = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="COVTEST-1" status="draft">
  <meta>
    <title>Coverage fixture</title>
    <system>covtest</system>
  </meta>
  <goals>
    <goal id="GOAL-A" title="Covered goal" priority="must"><statement>A.</statement></goal>
    <goal id="GOAL-B" title="Uncovered goal" priority="should"><statement>B.</statement></goal>
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
    <testCase id="TC-1" type="unit" title="t">
      <steps>run</steps>
      <expected>ok</expected>
    </testCase>
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
      <from><locator><external uri="file:src/index.ts"/></locator></from>
      <to><locator><local id="REQ-1"/></locator></to>
    </edge>
  </trace>
</rqml>`;

function doc(): RqmlDocument {
  const r = parse(DOC);
  if (!r.ok) throw new Error(`fixture failed to parse: ${r.error.message}`);
  return r.document;
}

describe("computeCoverage", () => {
  it("flags goals with no satisfying requirement", () => {
    expect(computeCoverage(doc()).uncoveredGoals).toEqual(["GOAL-B"]);
  });

  it("flags requirements with no verification", () => {
    expect(computeCoverage(doc()).unverifiedRequirements).toEqual(["REQ-2"]);
  });

  it("flags requirements with no implementation link", () => {
    expect(computeCoverage(doc()).unimplementedRequirements).toEqual(["REQ-2"]);
  });

  it("flags requirements that satisfy no goal or scenario as orphans", () => {
    expect(computeCoverage(doc()).orphanRequirements).toEqual(["REQ-2"]);
  });

  it("groups a requirement's edges by direction and type", () => {
    const cov = computeCoverage(doc());
    const req1 = cov.requirements.find((r) => r.id === "REQ-1");
    expect(req1?.outgoing.satisfies).toEqual(["E-SAT"]);
    expect(req1?.outgoing.verifiedBy).toEqual(["E-VER"]);
    expect(req1?.incoming.implements).toEqual(["E-IMPL"]);
  });

  it("is deterministic across runs", () => {
    expect(computeCoverage(doc())).toEqual(computeCoverage(doc()));
  });
});

describe("computeCoverage lifecycle awareness (REQ-CORE-STATUS-AWARE)", () => {
  it("reports the approved-only implementation gap separately", () => {
    // REQ-2 is unimplemented but draft: it must NOT appear in the approved gap.
    const cov = computeCoverage(doc());
    expect(cov.unimplementedRequirements).toEqual(["REQ-2"]);
    expect(cov.unimplementedApprovedRequirements).toEqual([]);
  });

  it("counts an approved requirement without implements in the approved gap", () => {
    const approved = DOC.replace(
      '<req id="REQ-2" type="FR" title="Orphan" priority="should" status="draft">',
      '<req id="REQ-2" type="FR" title="Orphan" priority="should" status="approved">',
    );
    const r = parse(approved);
    if (!r.ok) throw new Error("fixture failed to parse");
    expect(computeCoverage(r.document).unimplementedApprovedRequirements).toEqual([
      "REQ-2",
    ]);
  });

  it("flags implements edges targeting a non-approved requirement (CRIT-STATUS-IMPL)", () => {
    const premature = DOC.replace(
      '<to><locator><local id="REQ-1"/></locator></to>\n    </edge>\n  </trace>',
      `<to><locator><local id="REQ-1"/></locator></to>
    </edge>
    <edge id="E-IMPL-EARLY" type="implements">
      <from><locator><external uri="file:src/early.ts"/></locator></from>
      <to><locator><local id="REQ-2"/></locator></to>
    </edge>
  </trace>`,
    );
    const r = parse(premature);
    if (!r.ok) throw new Error("fixture failed to parse");
    const cov = computeCoverage(r.document);
    expect(cov.prematureImplementations).toEqual([
      { edgeId: "E-IMPL-EARLY", requirementId: "REQ-2" },
    ]);
    const diag = cov.diagnostics.find((d) => d.rule === "premature-implementation");
    expect(diag?.message).toContain("E-IMPL-EARLY");
    expect(diag?.message).toContain("REQ-2");
  });

  it("does not flag implements edges to approved requirements", () => {
    expect(computeCoverage(doc()).prematureImplementations).toEqual([]);
  });
});
