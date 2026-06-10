import { describe, expect, it } from "vitest";
import { checkIntegrity } from "../src/analyze/integrity.js";
import { SKELETON_KINDS, skeleton } from "../src/export/skeleton.js";
import { validate } from "../src/validate/index.js";

/** A document embedding every skeleton in its proper section, with the ids the
 * edge skeleton references declared so integrity passes too. */
function withSkeletons(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="SKEL-1" status="draft">
  <meta><title>t</title><system>s</system></meta>
  <goals>
    <goal id="GOAL-NAME" title="g"><statement>s</statement></goal>
  </goals>
  <requirements>
    ${skeleton("req")}
  </requirements>
  <behavior>
    ${skeleton("stateMachine")}
  </behavior>
  <verification>
    ${skeleton("testCase")}
  </verification>
  <trace>
    ${skeleton("edge")}
  </trace>
</rqml>`;
}

describe("skeleton (REQ-LOOP-SKELETON)", () => {
  it("covers the four required kinds", () => {
    expect([...SKELETON_KINDS]).toEqual(["req", "edge", "testCase", "stateMachine"]);
  });

  it("every skeleton keeps a document XSD-valid when inserted (CRIT-SKELETON-VALID)", () => {
    const result = validate(withSkeletons());
    expect(result.diagnostics).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("the embedded document passes integrity checking too", () => {
    expect(checkIntegrity(withSkeletons())).toEqual([]);
  });

  it("supports overriding the root id", () => {
    expect(skeleton("req", { id: "REQ-X-9" })).toContain('<req id="REQ-X-9"');
    expect(skeleton("edge", { id: "E-CUSTOM" })).toContain('<edge id="E-CUSTOM"');
  });
});
