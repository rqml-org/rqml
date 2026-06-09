import { describe, expect, it } from "vitest";
import { extractArtifact, sliceToMarkdown } from "../src/export/extract.js";
import type { RqmlDocument } from "../src/model/types.js";
import { parse } from "../src/parse/parse.js";

const DOC = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="EXTRACT-1" status="draft">
  <meta><title>t</title><system>s</system></meta>
  <goals>
    <goal id="G1" title="The goal"><statement>World peace.</statement></goal>
  </goals>
  <requirements>
    <req id="R1" type="FR" title="Do the thing" status="approved" priority="must">
      <statement>The system SHALL do the thing.</statement>
      <rationale>Things must be done.</rationale>
      <acceptance>
        <criterion id="C1">
          <given>a thing</given>
          <when>it is done</when>
          <then>it is observable</then>
        </criterion>
      </acceptance>
    </req>
    <req id="R2" type="NFR" title="Unrelated"><statement>Other.</statement></req>
  </requirements>
  <trace>
    <edge id="E-SAT" type="satisfies">
      <from><locator><local id="R1"/></locator></from>
      <to><locator><local id="G1"/></locator></to>
    </edge>
    <edge id="E-IMPL" type="implements">
      <from><locator><external uri="src/thing.ts" title="the impl"/></locator></from>
      <to><locator><local id="R1"/></locator></to>
    </edge>
  </trace>
</rqml>`;

function doc(): RqmlDocument {
  const r = parse(DOC);
  if (!r.ok) throw new Error(`fixture failed to parse: ${r.error.message}`);
  return r.document;
}

describe("extractArtifact (REQ-LOOP-SHOW)", () => {
  it("extracts a requirement with statement, acceptance, and trace neighborhood", () => {
    const slice = extractArtifact(doc(), "R1");
    expect(slice?.kind).toBe("req");
    expect(slice?.title).toBe("Do the thing");
    expect(slice?.statement).toContain("SHALL do the thing");
    expect(slice?.status).toBe("approved");
    expect(slice?.priority).toBe("must");
    expect(slice?.acceptance).toHaveLength(1);
    expect(slice?.acceptance?.[0]?.then).toBe("it is observable");
    expect(slice?.edges).toEqual([
      {
        edgeId: "E-SAT",
        type: "satisfies",
        direction: "outgoing",
        target: "G1",
        targetKind: "goal",
      },
      {
        edgeId: "E-IMPL",
        type: "implements",
        direction: "incoming",
        target: "src/thing.ts",
        targetKind: "external",
        title: "the impl",
      },
    ]);
  });

  it("contains nothing from unrelated artifacts", () => {
    const slice = extractArtifact(doc(), "R1");
    expect(JSON.stringify(slice)).not.toContain("R2");
    expect(JSON.stringify(slice)).not.toContain("Unrelated");
  });

  it("extracts non-requirement kinds with their statement", () => {
    const slice = extractArtifact(doc(), "G1");
    expect(slice?.kind).toBe("goal");
    expect(slice?.title).toBe("The goal");
    expect(slice?.statement).toBe("World peace.");
    expect(slice?.edges.map((e) => e.edgeId)).toEqual(["E-SAT"]);
    expect(slice?.edges[0]?.direction).toBe("incoming");
  });

  it("returns undefined for an undeclared id", () => {
    expect(extractArtifact(doc(), "NOPE")).toBeUndefined();
  });
});

describe("sliceToMarkdown", () => {
  it("renders identity, statement, acceptance, and trace", () => {
    const slice = extractArtifact(doc(), "R1");
    if (slice === undefined) throw new Error("slice missing");
    const md = sliceToMarkdown(slice);
    expect(md).toContain("## R1 — Do the thing");
    expect(md).toContain("kind: req (FR)");
    expect(md).toContain("The system SHALL do the thing.");
    expect(md).toContain("GIVEN a thing WHEN it is done THEN it is observable");
    expect(md).toContain("→ satisfies G1");
    expect(md).toContain("← implements src/thing.ts");
  });
});
