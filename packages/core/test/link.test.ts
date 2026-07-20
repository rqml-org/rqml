import { describe, expect, it } from "vitest";
import { computeCoverage } from "../src/check/coverage.js";
import { appendTraceEdge, updateTraceEdge } from "../src/edit/link.js";
import { parse } from "../src/parse/parse.js";
import { validate } from "../src/validate/index.js";

const WITH_TRACE = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="LINK-1" status="draft">
  <meta><title>t</title><system>s</system></meta>
  <goals>
    <goal id="G1" title="g"><statement>s</statement></goal>
    <goal id="G2" title="g2"><statement>s</statement></goal>
  </goals>
  <requirements>
    <!-- a load-bearing comment that must survive editing -->
    <req id="REQ-A" type="FR" title="r" status="approved"><statement>s</statement></req>
  </requirements>
  <trace>
    <edge id="E-SAT" type="satisfies">
      <from><locator><local id="REQ-A"/></locator></from>
      <to><locator><local id="G1"/></locator></to>
    </edge>
  </trace>
</rqml>`;

const NO_TRACE = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="LINK-2" status="draft">
  <meta><title>t</title><system>s</system></meta>
  <requirements>
    <req id="REQ-A" type="FR" title="r" status="approved"><statement>s</statement></req>
  </requirements>
  <governance>
    <issue id="ISS-1"><statement>open</statement></issue>
  </governance>
</rqml>`;

describe("appendTraceEdge (REQ-LOOP-LINK)", () => {
  it("appends an implements edge that coverage then counts (CRIT-LINK-ROUNDTRIP)", () => {
    const result = appendTraceEdge(WITH_TRACE, {
      from: "REQ-A",
      to: "src/a.ts#thing",
      type: "implements",
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.edgeId).toBe("E-IMPL-A");

    const validation = validate(result.xml);
    expect(validation.valid).toBe(true);

    const parsed = parse(result.xml);
    if (!parsed.ok) throw new Error("result did not parse");
    expect(computeCoverage(parsed.document).unimplementedRequirements).toEqual([]);
  });

  it("appends a local satisfies edge that coverage then counts (CRIT-LINK-LOCAL)", () => {
    const before = parse(WITH_TRACE);
    if (!before.ok) throw new Error("fixture did not parse");
    expect(computeCoverage(before.document).uncoveredGoals).toContain("G2");

    const result = appendTraceEdge(WITH_TRACE, {
      from: "REQ-A",
      to: "G2",
      type: "satisfies",
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.edgeId).toBe("E-SAT-A-G2");
    expect(result.edgeXml).toContain(
      '<from><locator><local id="REQ-A"/></locator></from>',
    );
    expect(result.edgeXml).toContain('<to><locator><local id="G2"/></locator></to>');
    expect(validate(result.xml).valid).toBe(true);

    const parsed = parse(result.xml);
    if (!parsed.ok) throw new Error("result did not parse");
    expect(computeCoverage(parsed.document).uncoveredGoals).not.toContain("G2");
  });

  it("stamps draft status and a createdBy identity (CRIT-LINK-PROVENANCE)", () => {
    const result = appendTraceEdge(WITH_TRACE, {
      from: "REQ-A",
      to: "G2",
      type: "satisfies",
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.edgeXml).toContain('status="draft"');
    expect(result.edgeXml).toContain('createdBy="rqml"');

    const parsed = parse(result.xml);
    if (!parsed.ok) throw new Error("result did not parse");
    const edge = parsed.document.trace.find((e) => e.id === result.edgeId);
    expect(edge?.status).toBe("draft");
    expect(edge?.createdBy).toBe("rqml");
  });

  it("honors status and createdBy overrides", () => {
    const result = appendTraceEdge(WITH_TRACE, {
      from: "REQ-A",
      to: "G2",
      type: "satisfies",
      status: "approved",
      createdBy: "gardar",
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.edgeXml).toContain('status="approved"');
    expect(result.edgeXml).toContain('createdBy="gardar"');
  });

  it("emits notes, confidence, and tags when given", () => {
    const result = appendTraceEdge(WITH_TRACE, {
      from: "REQ-A",
      to: "G2",
      type: "satisfies",
      notes: "gate & <check> hold",
      confidence: 0.9,
      tags: ["safety", "compliance"],
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.edgeXml).toContain('confidence="0.9"');
    expect(result.edgeXml).toContain('tags="safety compliance"');
    expect(result.edgeXml).toContain("<notes>gate &amp; &lt;check&gt; hold</notes>");
    expect(validate(result.xml).valid).toBe(true);

    const parsed = parse(result.xml);
    if (!parsed.ok) throw new Error("result did not parse");
    const edge = parsed.document.trace.find((e) => e.id === result.edgeId);
    expect(edge?.confidence).toBe(0.9);
    expect(edge?.tags).toEqual(["safety", "compliance"]);
    expect(edge?.notes).toContain("gate & <check> hold");
  });

  it("orients implements external → local whichever order the endpoints came in", () => {
    const artifactFirst = appendTraceEdge(WITH_TRACE, {
      from: "REQ-A",
      to: "src/a.ts",
      type: "implements",
    });
    const uriFirst = appendTraceEdge(WITH_TRACE, {
      from: "src/a.ts",
      to: "REQ-A",
      type: "implements",
    });
    if (!artifactFirst.ok || !uriFirst.ok) throw new Error("append failed");
    expect(artifactFirst.edgeXml).toBe(uriFirst.edgeXml);
    expect(artifactFirst.edgeXml).toContain(
      '<to><locator><local id="REQ-A"/></locator></to>',
    );
  });

  it("records general types exactly from → to", () => {
    const result = appendTraceEdge(WITH_TRACE, {
      from: "G2",
      to: "REQ-A",
      type: "refines",
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.edgeId).toBe("E-REF-G2-A");
    expect(result.edgeXml).toContain('<from><locator><local id="G2"/></locator></from>');
    expect(result.edgeXml).toContain('<to><locator><local id="REQ-A"/></locator></to>');
  });

  it("preserves comments and existing formatting", () => {
    const result = appendTraceEdge(WITH_TRACE, {
      from: "REQ-A",
      to: "src/a.ts",
      type: "implements",
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.xml).toContain("a load-bearing comment that must survive editing");
    expect(result.xml).toContain('    <edge id="E-SAT" type="satisfies">');
    // New edge picks up the surrounding indentation.
    expect(result.xml).toContain(
      '    <edge id="E-IMPL-A" type="implements" status="draft" createdBy="rqml">',
    );
  });

  it("orients verifiedBy edges requirement → test", () => {
    const result = appendTraceEdge(WITH_TRACE, {
      from: "REQ-A",
      to: "test/a.test.ts",
      type: "verifiedBy",
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.edgeId).toBe("E-VER-A");
    expect(result.edgeXml).toContain(
      '<from><locator><local id="REQ-A"/></locator></from>',
    );
    expect(result.edgeXml).toContain('uri="test/a.test.ts" kind="test"');
  });

  it("creates the trace section before governance when none exists", () => {
    const result = appendTraceEdge(NO_TRACE, {
      from: "REQ-A",
      to: "src/a.ts",
      type: "implements",
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.xml.indexOf("<trace>")).toBeGreaterThan(0);
    expect(result.xml.indexOf("<trace>")).toBeLessThan(result.xml.indexOf("<governance"));
    expect(validate(result.xml).valid).toBe(true);
  });

  it("derives a fresh edge id when the default is taken", () => {
    const first = appendTraceEdge(WITH_TRACE, {
      from: "REQ-A",
      to: "src/a.ts",
      type: "implements",
    });
    if (!first.ok) throw new Error(first.error);
    const second = appendTraceEdge(first.xml, {
      from: "REQ-A",
      to: "src/other.ts",
      type: "implements",
    });
    if (!second.ok) throw new Error(second.error);
    expect(second.edgeId).toBe("E-IMPL-A-2");
  });

  it("rejects undeclared bare ids instead of treating them as external", () => {
    const typo = appendTraceEdge(WITH_TRACE, {
      from: "REQ-NOPE",
      to: "src/a.ts",
      type: "implements",
    });
    expect(typo.ok).toBe(false);
    if (!typo.ok) expect(typo.error).toContain("not a declared artifact id");

    // A bare filename with no path separator gets the same protection.
    const bareFile = appendTraceEdge(WITH_TRACE, {
      from: "REQ-A",
      to: "a.ts",
      type: "implements",
    });
    expect(bareFile.ok).toBe(false);
    if (!bareFile.ok) expect(bareFile.error).toContain("./a.ts");
  });

  it("rejects endpoint combinations the type cannot take", () => {
    const bothLocal = appendTraceEdge(WITH_TRACE, {
      from: "REQ-A",
      to: "G1",
      type: "implements",
    });
    expect(bothLocal.ok).toBe(false);
    if (!bothLocal.ok) expect(bothLocal.error).toContain("one declared artifact");

    const bothExternal = appendTraceEdge(WITH_TRACE, {
      from: "src/a.ts",
      to: "urn:gdpr:article:17",
      type: "conformsTo",
    });
    expect(bothExternal.ok).toBe(false);
    if (!bothExternal.ok) expect(bothExternal.error).toContain("at least one endpoint");

    const docRef = appendTraceEdge(WITH_TRACE, {
      from: "REQ-A",
      to: "rqml:other.rqml#REQ-X",
      type: "dependsOn",
    });
    expect(docRef.ok).toBe(false);
    if (!docRef.ok) expect(docRef.error).toContain("document locators");
  });

  it("rejects taken ids, malformed ids, and malformed extras", () => {
    const taken = appendTraceEdge(WITH_TRACE, {
      from: "REQ-A",
      to: "src/a.ts",
      type: "implements",
      edgeId: "E-SAT",
    });
    expect(taken.ok).toBe(false);

    const malformed = appendTraceEdge(WITH_TRACE, {
      from: "REQ-A",
      to: "src/a.ts",
      type: "implements",
      edgeId: "0bad id",
    });
    expect(malformed.ok).toBe(false);

    const badConfidence = appendTraceEdge(WITH_TRACE, {
      from: "REQ-A",
      to: "G2",
      type: "satisfies",
      confidence: 1.5,
    });
    expect(badConfidence.ok).toBe(false);

    const badTag = appendTraceEdge(WITH_TRACE, {
      from: "REQ-A",
      to: "G2",
      type: "satisfies",
      tags: ["has space"],
    });
    expect(badTag.ok).toBe(false);

    const hintsWithoutExternal = appendTraceEdge(WITH_TRACE, {
      from: "REQ-A",
      to: "G2",
      type: "satisfies",
      kind: "code",
    });
    expect(hintsWithoutExternal.ok).toBe(false);
  });

  it("escapes attribute values in the generated edge", () => {
    const result = appendTraceEdge(WITH_TRACE, {
      from: "REQ-A",
      to: 'src/a"&<>.ts',
      type: "implements",
      title: "a & b",
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.edgeXml).toContain("src/a&quot;&amp;&lt;&gt;.ts");
    expect(result.edgeXml).toContain('title="a &amp; b"');
    const parsed = parse(result.xml);
    expect(parsed.ok).toBe(true);
  });

  it("is deterministic", () => {
    const request = { from: "REQ-A", to: "src/a.ts", type: "implements" as const };
    expect(appendTraceEdge(WITH_TRACE, request)).toEqual(
      appendTraceEdge(WITH_TRACE, request),
    );
  });
});

describe("updateTraceEdge (REQ-LOOP-RELINK)", () => {
  /** WITH_TRACE plus an implements edge recorded the mechanical way. */
  function linked(
    uri = "src/a.ts",
    extra: Partial<Parameters<typeof appendTraceEdge>[1]> = {},
  ) {
    const result = appendTraceEdge(WITH_TRACE, {
      from: "REQ-A",
      to: uri,
      type: "implements",
      ...extra,
    });
    if (!result.ok) throw new Error(result.error);
    return result;
  }

  it("repoints the edge in place without duplicating it (CRIT-RELINK-UPDATE)", () => {
    const result = updateTraceEdge(linked().xml, {
      artifactId: "REQ-A",
      uri: "src/b.ts",
      type: "implements",
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.edgeId).toBe("E-IMPL-A");
    expect(result.previousUri).toBe("src/a.ts");
    expect(result.xml).toContain('uri="src/b.ts"');
    expect(result.xml).not.toContain('uri="src/a.ts"');
    expect(result.xml.match(/id="E-IMPL-A"/g)).toHaveLength(1);
    expect(validate(result.xml).valid).toBe(true);
  });

  it("preserves comments, formatting, and the existing kind and title", () => {
    const start = linked("src/a.ts", { title: "the impl" });
    const result = updateTraceEdge(start.xml, {
      artifactId: "REQ-A",
      uri: "src/b.ts",
      type: "implements",
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.xml).toContain("a load-bearing comment that must survive editing");
    expect(result.xml).toContain('    <edge id="E-SAT" type="satisfies">');
    expect(result.edgeXml).toContain('uri="src/b.ts" kind="code" title="the impl"');
  });

  it("overrides kind and title when provided", () => {
    const result = updateTraceEdge(linked().xml, {
      artifactId: "REQ-A",
      uri: "config/b.json",
      type: "implements",
      kind: "config",
      title: "new title",
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.edgeXml).toContain(
      'uri="config/b.json" kind="config" title="new title"',
    );
  });

  it("matches an explicitly named edge via edgeId", () => {
    const start = linked("src/a.ts", { edgeId: "E-IMPL-CUSTOM" });
    const derived = updateTraceEdge(start.xml, {
      artifactId: "REQ-A",
      uri: "src/b.ts",
      type: "implements",
    });
    expect(derived.ok).toBe(false); // E-IMPL-A does not exist

    const explicit = updateTraceEdge(start.xml, {
      artifactId: "REQ-A",
      uri: "src/b.ts",
      type: "implements",
      edgeId: "E-IMPL-CUSTOM",
    });
    if (!explicit.ok) throw new Error(explicit.error);
    expect(explicit.edgeId).toBe("E-IMPL-CUSTOM");
    expect(explicit.xml).toContain('uri="src/b.ts"');
  });

  it("rejects missing edges, type mismatches, and artifact mismatches", () => {
    const start = linked();

    const missing = updateTraceEdge(start.xml, {
      artifactId: "REQ-A",
      uri: "x.ts",
      type: "verifiedBy", // derives E-VER-A, which does not exist
    });
    expect(missing.ok).toBe(false);

    const typeMismatch = updateTraceEdge(start.xml, {
      artifactId: "REQ-A",
      uri: "x.ts",
      type: "implements",
      edgeId: "E-SAT", // exists, but is a satisfies edge
    });
    expect(typeMismatch.ok).toBe(false);
    if (!typeMismatch.ok) expect(typeMismatch.error).toContain("satisfies");

    const wrongArtifact = updateTraceEdge(start.xml, {
      artifactId: "G1", // declared, but not the edge's local endpoint
      uri: "x.ts",
      type: "implements",
      edgeId: "E-IMPL-A",
    });
    expect(wrongArtifact.ok).toBe(false);
  });

  it("rejects an edge with no external locator", () => {
    const localOnly = WITH_TRACE.replace(
      "</trace>",
      `  <edge id="E-IMPL-LOCAL" type="implements">
      <from><locator><local id="REQ-A"/></locator></from>
      <to><locator><local id="G1"/></locator></to>
    </edge>
  </trace>`,
    );
    const result = updateTraceEdge(localOnly, {
      artifactId: "REQ-A",
      uri: "x.ts",
      type: "implements",
      edgeId: "E-IMPL-LOCAL",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("no external locator");
  });

  it("is deterministic", () => {
    const start = linked();
    const request = { artifactId: "REQ-A", uri: "src/b.ts", type: "implements" as const };
    expect(updateTraceEdge(start.xml, request)).toEqual(
      updateTraceEdge(start.xml, request),
    );
  });

  it("matches the append-derived id for a long artifact id (no derivation drift)", () => {
    // A requirement whose id sans REQ- exceeds the 76-char cap: append truncates
    // the derived edge id, and update must derive the same truncated id.
    const longId = `REQ-${"X".repeat(74)}`;
    const spec = WITH_TRACE.replace(
      '<req id="REQ-A" type="FR" title="r" status="approved"><statement>s</statement></req>',
      `<req id="REQ-A" type="FR" title="r" status="approved"><statement>s</statement></req>
    <req id="${longId}" type="FR" title="r" status="approved"><statement>s</statement></req>`,
    );
    const appended = appendTraceEdge(spec, {
      from: longId,
      to: "src/a.ts",
      type: "implements",
    });
    if (!appended.ok) throw new Error(appended.error);
    expect(appended.edgeId.length).toBeLessThanOrEqual(80);
    expect(validate(appended.xml).valid).toBe(true);

    const updated = updateTraceEdge(appended.xml, {
      artifactId: longId,
      uri: "src/b.ts",
      type: "implements",
    });
    if (!updated.ok) throw new Error(updated.error);
    expect(updated.edgeId).toBe(appended.edgeId);
    expect(updated.previousUri).toBe("src/a.ts");
  });
});
