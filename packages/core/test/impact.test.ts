import { describe, expect, it } from "vitest";
import type { RqmlDocument } from "../src/model/types.js";
import { parse } from "../src/parse/parse.js";
import { impactOf } from "../src/trace/impact.js";

// G1 ← satisfies ← R1 → verifiedBy → T1, plus R1 implemented by external code.
const DOC = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="IMPACT-1" status="draft">
  <meta><title>t</title><system>s</system></meta>
  <goals>
    <goal id="G1" title="g"><statement>s</statement></goal>
  </goals>
  <requirements>
    <req id="R1" type="FR" title="r"><statement>s</statement></req>
    <req id="R2" type="FR" title="unrelated"><statement>s</statement></req>
  </requirements>
  <verification>
    <testCase id="T1" type="unit" title="t"/>
  </verification>
  <trace>
    <edge id="E-SAT" type="satisfies">
      <from><locator><local id="R1"/></locator></from>
      <to><locator><local id="G1"/></locator></to>
    </edge>
    <edge id="E-VER" type="verifiedBy">
      <from><locator><local id="R1"/></locator></from>
      <to><locator><local id="T1"/></locator></to>
    </edge>
    <edge id="E-IMPL" type="implements">
      <from><locator><external uri="src/r1.ts"/></locator></from>
      <to><locator><local id="R1"/></locator></to>
    </edge>
  </trace>
</rqml>`;

function doc(): RqmlDocument {
  const r = parse(DOC);
  if (!r.ok) throw new Error(`fixture failed to parse: ${r.error.message}`);
  return r.document;
}

describe("impactOf (REQ-LOOP-IMPACT)", () => {
  it("reaches the requirement and, transitively, its test from a goal", () => {
    const report = impactOf(doc(), "G1");
    const byId = new Map(report.affected.map((a) => [a.id, a]));

    const req = byId.get("R1");
    expect(req?.distance).toBe(1);
    expect(req?.kind).toBe("req");
    expect(req?.path.map((s) => s.edgeId)).toEqual(["E-SAT"]);

    const test = byId.get("T1");
    expect(test?.distance).toBe(2);
    expect(test?.kind).toBe("testCase");
    expect(test?.path.map((s) => s.edgeId)).toEqual(["E-SAT", "E-VER"]);
  });

  it("includes external endpoints as leaves without traversing through them", () => {
    const report = impactOf(doc(), "G1");
    const code = report.affected.find((a) => a.id === "src/r1.ts");
    expect(code?.kind).toBe("external");
    expect(code?.distance).toBe(2);
  });

  it("does not reach unrelated artifacts", () => {
    const ids = impactOf(doc(), "G1").affected.map((a) => a.id);
    expect(ids).not.toContain("R2");
    expect(ids).not.toContain("G1");
  });

  it("groups affected ids by reaching edge type and direction", () => {
    const report = impactOf(doc(), "R1");
    expect(report.groups).toEqual([
      { direction: "incoming", type: "implements", ids: ["src/r1.ts"] },
      { direction: "outgoing", type: "satisfies", ids: ["G1"] },
      { direction: "outgoing", type: "verifiedBy", ids: ["T1"] },
    ]);
  });

  it("is cycle-safe", () => {
    const cyclic = DOC.replace(
      "</trace>",
      `<edge id="E-CYCLE" type="refines">
        <from><locator><local id="G1"/></locator></from>
        <to><locator><local id="R1"/></locator></to>
      </edge>
      </trace>`,
    );
    const r = parse(cyclic);
    if (!r.ok) throw new Error("cyclic fixture failed to parse");
    const report = impactOf(r.document, "G1");
    // Terminates, and each artifact is reported once.
    const ids = report.affected.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
