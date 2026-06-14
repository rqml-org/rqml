import { describe, expect, it } from "vitest";
import { approvalGate } from "../src/analyze/gate.js";
import { parse } from "../src/parse/parse.js";

// REQ-1 approved + implemented (fine); REQ-2 draft + implemented (premature).
const DOC = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="GATETEST-1" status="draft">
  <meta><title>t</title><system>s</system></meta>
  <requirements>
    <req id="REQ-1" type="FR" title="One" status="approved"><statement>one SHALL.</statement></req>
    <req id="REQ-2" type="FR" title="Two" status="draft"><statement>two SHALL.</statement></req>
  </requirements>
  <trace>
    <edge id="E-IMPL-1" type="implements">
      <from><locator><external uri="src/one.ts" kind="code"/></locator></from>
      <to><locator><local id="REQ-1"/></locator></to>
    </edge>
    <edge id="E-IMPL-2" type="implements">
      <from><locator><external uri="src/two.ts#run" kind="code"/></locator></from>
      <to><locator><local id="REQ-2"/></locator></to>
    </edge>
  </trace>
</rqml>`;

function doc() {
  const r = parse(DOC);
  if (!r.ok) throw new Error(`fixture failed to parse: ${r.error.message}`);
  return r.document;
}

describe("approvalGate (REQ-CORE-APPROVAL-VERDICT / REQ-ENFORCE-APPROVAL-GATE)", () => {
  it("blocks implementation linked to a non-approved requirement", () => {
    const v = approvalGate(doc());
    expect(v.blocked).toBe(true);
    expect(v.findings).toEqual([
      { edgeId: "E-IMPL-2", requirementId: "REQ-2", uri: "src/two.ts#run" },
    ]);
  });

  it("does not flag approved implementations", () => {
    expect(approvalGate(doc()).findings.some((f) => f.requirementId === "REQ-1")).toBe(
      false,
    );
  });

  it("scopes findings to changed paths (ignoring #fragments)", () => {
    expect(approvalGate(doc(), { changedPaths: ["src/one.ts"] }).blocked).toBe(false);
    expect(
      approvalGate(doc(), { changedPaths: ["src/two.ts"] }).findings.map((f) => f.edgeId),
    ).toEqual(["E-IMPL-2"]);
  });

  it("is deterministic across runs", () => {
    expect(approvalGate(doc())).toEqual(approvalGate(doc()));
  });
});
