import { describe, expect, it } from "vitest";
import { checkIntegrity } from "../src/analyze/integrity.js";
import { appendTraceEdge, updateTraceEdge } from "../src/edit/link.js";
import { parse } from "../src/parse/parse.js";
import { serialize } from "../src/parse/serialize.js";
import { validate } from "../src/validate/index.js";

/** The same document content in both serializations (REQ-CORE-COMPACT-PARITY). */
function doc(version: "2.1.0" | "2.2.0", trace: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/${version}" version="${version}" docId="CT-1" status="draft">
  <meta><title>t</title><system>s</system></meta>
  <goals><goal id="G1" title="g"><statement>s</statement></goal></goals>
  <requirements>
    <req id="REQ-A" type="FR" title="r" status="approved"><statement>s</statement></req>
  </requirements>
  <trace>
${trace}
  </trace>
</rqml>`;
}

const NESTED_EDGES = `    <edge id="E-1" type="satisfies" confidence="0.9">
      <from><locator><local id="REQ-A"/></locator></from>
      <to><locator><local id="G1"/></locator></to>
    </edge>
    <edge id="E-2" type="dependsOn">
      <from><locator><local id="REQ-A"/></locator></from>
      <to><locator><doc uri="auth.rqml" docId="AUTH-1" id="REQ-X" version="2.1.0" git="a1b2"/></locator></to>
    </edge>
    <edge id="E-3" type="implements" status="draft" createdBy="rqml" tags="safety compliance">
      <from><locator><external uri="packages/core/src/a.ts#f" kind="code" title="impl"/></locator></from>
      <to><locator><local id="REQ-A"/></locator></to>
      <notes>why &amp; how</notes>
    </edge>`;

const COMPACT_EDGES = `    <edge id="E-1" type="satisfies" from="REQ-A" to="G1" confidence="0.9"/>
    <edge id="E-2" type="dependsOn" from="REQ-A" to="rqml:auth.rqml#REQ-X;version=2.1.0;git=a1b2;docId=AUTH-1"/>
    <edge id="E-3" type="implements" from="packages/core/src/a.ts#f" fromKind="code" fromTitle="impl" to="REQ-A" status="draft" createdBy="rqml" tags="safety compliance">
      <notes>why &amp; how</notes>
    </edge>`;

describe("compact trace edges (RFC-0003)", () => {
  it("parses the compact form to the identical model as nested (CRIT-COMPACT-LOSSLESS)", () => {
    const nested = parse(doc("2.1.0", NESTED_EDGES));
    const compact = parse(doc("2.2.0", COMPACT_EDGES));
    if (!nested.ok || !compact.ok) throw new Error("fixture did not parse");
    expect(compact.document.trace).toEqual(nested.document.trace);
    expect(compact.document.trace).toHaveLength(3);
  });

  it("both forms validate against their own schema", () => {
    expect(validate(doc("2.1.0", NESTED_EDGES)).valid).toBe(true);
    expect(validate(doc("2.2.0", COMPACT_EDGES)).valid).toBe(true);
  });

  it("reports the same violations in both forms (CRIT-PARITY-FORMS)", () => {
    const danglingNested = doc(
      "2.1.0",
      `    <edge id="E-1" type="satisfies">
      <from><locator><local id="REQ-NOPE"/></locator></from>
      <to><locator><local id="G1"/></locator></to>
    </edge>`,
    );
    const danglingCompact = doc(
      "2.2.0",
      `    <edge id="E-1" type="satisfies" from="REQ-NOPE" to="G1"/>`,
    );
    const nestedDiags = checkIntegrity(danglingNested);
    const compactDiags = checkIntegrity(danglingCompact);
    expect(nestedDiags.map((d) => [d.rule, d.message])).toEqual(
      compactDiags.map((d) => [d.rule, d.message]),
    );
    expect(compactDiags).toHaveLength(1);
    expect(compactDiags[0]?.rule).toBe("unresolved-local-ref");

    // Duplicate edge ids are caught identically too.
    const dupCompact = doc(
      "2.2.0",
      `    <edge id="E-1" type="satisfies" from="REQ-A" to="G1"/>
    <edge id="E-1" type="refines" from="G1" to="REQ-A"/>`,
    );
    expect(checkIntegrity(dupCompact).some((d) => d.rule === "duplicate-id")).toBe(true);
  });

  it("mirrors the parser's per-edge form decision on mixed-form edges", () => {
    // One nested endpoint child + both attrs: parseEdge fails (needs both
    // children), so the parser reads the ATTRS — integrity must check the
    // same set (REQ-CORE-COMPACT-PARITY).
    const mixed = doc(
      "2.2.0",
      `    <edge id="E-1" type="satisfies" from="REQ-MISSING" to="G1">
      <from><locator><local id="REQ-A"/></locator></from>
    </edge>`,
    );
    const parsed = parse(mixed);
    if (!parsed.ok) throw new Error("fixture did not parse");
    const edge = parsed.document.trace[0];
    expect(edge?.from).toEqual({ kind: "local", id: "REQ-MISSING" });
    const diags = checkIntegrity(mixed);
    expect(
      diags.some(
        (d) => d.rule === "unresolved-local-ref" && d.message.includes("REQ-MISSING"),
      ),
    ).toBe(true);
    expect(diags.some((d) => d.message.includes("REQ-A"))).toBe(false);
  });

  it("reports edges the parser drops instead of letting them vanish", () => {
    // Missing to attribute: parse drops the edge; integrity must say so.
    const missingTo = doc("2.2.0", `    <edge id="E-1" type="satisfies" from="REQ-A"/>`);
    const parsedMissing = parse(missingTo);
    if (!parsedMissing.ok) throw new Error("fixture did not parse");
    expect(parsedMissing.document.trace).toHaveLength(0);
    expect(checkIntegrity(missingTo).some((d) => d.rule === "malformed-trace-edge")).toBe(
      true,
    );

    // A malformed non-rqml endpoint (whitespace path) likewise.
    const spacePath = doc(
      "2.2.0",
      `    <edge id="E-1" type="implements" from="src/My File.ts" to="REQ-A"/>`,
    );
    const parsedSpace = parse(spacePath);
    if (!parsedSpace.ok) throw new Error("fixture did not parse");
    expect(parsedSpace.document.trace).toHaveLength(0);
    expect(checkIntegrity(spacePath).some((d) => d.rule === "malformed-trace-edge")).toBe(
      true,
    );
  });

  it("rejects rqml: endpoints without a valid fragment (CRIT-PARITY-DOCREF)", () => {
    const broken = doc(
      "2.2.0",
      `    <edge id="E-1" type="dependsOn" from="REQ-A" to="rqml:auth.rqml"/>`,
    );
    const diags = checkIntegrity(broken);
    expect(diags.some((d) => d.rule === "invalid-doc-locator")).toBe(true);
    // And the parser does not surface it as an external edge.
    const parsed = parse(broken);
    if (!parsed.ok) throw new Error("fixture did not parse");
    expect(parsed.document.trace).toHaveLength(0);
  });

  it("serializes a 2.2.0 document with compact edges and plain-decimal confidence", () => {
    const parsed = parse(doc("2.2.0", COMPACT_EDGES));
    if (!parsed.ok) throw new Error("fixture did not parse");
    const edge = parsed.document.trace.find((e) => e.id === "E-1");
    if (edge) edge.confidence = 1e-7;
    const out = serialize(parsed.document);
    expect(out).toContain('from="REQ-A" to="G1" confidence="0.0000001"');
    expect(out).not.toContain("<locator>");
    expect(out).toContain(
      'to="rqml:auth.rqml#REQ-X;version=2.1.0;git=a1b2;docId=AUTH-1"',
    );
    expect(validate(out).valid).toBe(true);
  });

  it("link refuses whitespace-bearing paths and never repoints a commented-out copy", () => {
    const base = doc("2.2.0", COMPACT_EDGES);
    const spacey = appendTraceEdge(base, {
      from: "REQ-A",
      to: "src/My File.ts",
      type: "implements",
    });
    expect(spacey.ok).toBe(false);
    if (!spacey.ok) expect(spacey.error).toContain("whitespace");

    // A commented-out copy of the edge precedes the live one: the repoint
    // must land on the live edge, byte-preserving the comment.
    const linked = appendTraceEdge(base, {
      from: "REQ-A",
      to: "src/new.ts",
      type: "implements",
    });
    if (!linked.ok) throw new Error(linked.error);
    const withComment = linked.xml.replace(
      "<trace>",
      `<trace>
    <!-- retired: <edge id="E-IMPL-A" type="implements" from="src/old.ts" fromKind="code" to="REQ-A" status="draft" createdBy="rqml"/> -->`,
    );
    const repointed = updateTraceEdge(withComment, {
      artifactId: "REQ-A",
      uri: "src/moved.ts",
      type: "implements",
    });
    if (!repointed.ok) throw new Error(repointed.error);
    expect(repointed.xml).toContain('from="src/old.ts"'); // comment untouched
    expect(repointed.xml).toContain('from="src/moved.ts"'); // live edge moved
    expect(repointed.xml).not.toContain('from="src/new.ts"');
  });

  it("link appends compact edges on 2.2.0 documents and repoints them in place", () => {
    const base = doc("2.2.0", COMPACT_EDGES);
    const appended = appendTraceEdge(base, {
      from: "REQ-A",
      to: "src/new.ts",
      type: "verifiedBy",
      notes: "covers the gate",
    });
    if (!appended.ok) throw new Error(appended.error);
    expect(appended.edgeXml).toContain(
      '<edge id="E-VER-A" type="verifiedBy" from="REQ-A" to="src/new.ts" toKind="test" status="draft" createdBy="rqml">',
    );
    expect(appended.edgeXml).toContain("<notes>covers the gate</notes>");
    expect(validate(appended.xml).valid).toBe(true);

    const repointed = updateTraceEdge(appended.xml, {
      artifactId: "REQ-A",
      uri: "test/other.test.ts",
      type: "verifiedBy",
    });
    if (!repointed.ok) throw new Error(repointed.error);
    expect(repointed.previousUri).toBe("src/new.ts");
    expect(repointed.edgeXml).toContain('to="test/other.test.ts"');
    expect(repointed.xml).toContain("<notes>covers the gate</notes>");
    expect(validate(repointed.xml).valid).toBe(true);
  });
});
