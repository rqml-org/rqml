import { describe, expect, it } from "vitest";
import { checkIntegrity } from "../src/analyze/integrity.js";

const clean = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="D" status="draft">
  <meta><title>t</title><system>s</system></meta>
  <goals>
    <goal id="G1" title="g"><statement>s</statement></goal>
  </goals>
  <requirements>
    <reqPackage id="PKG-1" title="p">
      <req id="R1" type="FR" title="r"><statement>s</statement></req>
    </reqPackage>
  </requirements>
  <trace>
    <edge id="E1" type="satisfies">
      <from><locator><local id="R1"/></locator></from>
      <to><locator><local id="G1"/></locator></to>
    </edge>
  </trace>
</rqml>`;

describe("checkIntegrity", () => {
  it("reports nothing for a clean document, including an edge to a goal", () => {
    // A trace edge pointing at a goal (not a requirement) must NOT be flagged:
    // this is the cross-section coverage resolveTrace lacks.
    expect(checkIntegrity(clean)).toEqual([]);
  });

  it("flags a duplicate id across sections", () => {
    const dup = clean.replace(
      '<goal id="G1" title="g">',
      '<goal id="R1" title="g">',
    );
    const diags = checkIntegrity(dup);
    const dupDiags = diags.filter((d) => d.rule === "duplicate-id");
    expect(dupDiags).toHaveLength(1);
    expect(dupDiags[0]?.source).toBe("validate");
    expect(dupDiags[0]?.severity).toBe("error");
    expect(dupDiags[0]?.message).toContain("R1");
    expect(typeof dupDiags[0]?.line).toBe("number");
  });

  it("flags a dangling nested (2.1.0) trace ref", () => {
    const broken = clean.replace('<local id="G1"/>', '<local id="NOPE"/>');
    const diags = checkIntegrity(broken);
    expect(diags).toHaveLength(1);
    expect(diags[0]?.source).toBe("trace");
    expect(diags[0]?.rule).toBe("unresolved-local-ref");
    expect(diags[0]?.message).toContain("E1");
    expect(diags[0]?.message).toContain("NOPE");
    expect(diags[0]?.message).toContain("to");
    expect(typeof diags[0]?.line).toBe("number");
  });

  it("flags a dangling flat (2.0.1) traceEdge ref", () => {
    const flat = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.0.1" version="2.0.1" docId="D" status="draft">
  <requirements>
    <req id="R1" type="FR" title="r"><statement>s</statement></req>
  </requirements>
  <trace>
    <traceEdge id="E1" from="R1" to="NOPE" type="satisfies"/>
  </trace>
</rqml>`;
    const diags = checkIntegrity(flat);
    expect(diags).toHaveLength(1);
    expect(diags[0]?.rule).toBe("unresolved-local-ref");
    expect(diags[0]?.message).toContain("NOPE");
  });

  it("returns nothing for malformed input (parse handles that)", () => {
    expect(checkIntegrity("<rqml><unclosed>")).toEqual([]);
  });
});
