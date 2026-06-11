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
      artifactId: "REQ-A",
      uri: "src/a.ts#thing",
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

  it("preserves comments and existing formatting", () => {
    const result = appendTraceEdge(WITH_TRACE, {
      artifactId: "REQ-A",
      uri: "src/a.ts",
      type: "implements",
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.xml).toContain("a load-bearing comment that must survive editing");
    expect(result.xml).toContain('    <edge id="E-SAT" type="satisfies">');
    // New edge picks up the surrounding indentation.
    expect(result.xml).toContain('    <edge id="E-IMPL-A" type="implements">');
  });

  it("orients verifiedBy edges requirement → test", () => {
    const result = appendTraceEdge(WITH_TRACE, {
      artifactId: "REQ-A",
      uri: "test/a.test.ts",
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
      artifactId: "REQ-A",
      uri: "src/a.ts",
      type: "implements",
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.xml.indexOf("<trace>")).toBeGreaterThan(0);
    expect(result.xml.indexOf("<trace>")).toBeLessThan(result.xml.indexOf("<governance"));
    expect(validate(result.xml).valid).toBe(true);
  });

  it("derives a fresh edge id when the default is taken", () => {
    const first = appendTraceEdge(WITH_TRACE, {
      artifactId: "REQ-A",
      uri: "src/a.ts",
      type: "implements",
    });
    if (!first.ok) throw new Error(first.error);
    const second = appendTraceEdge(first.xml, {
      artifactId: "REQ-A",
      uri: "src/other.ts",
      type: "implements",
    });
    if (!second.ok) throw new Error(second.error);
    expect(second.edgeId).toBe("E-IMPL-A-2");
  });

  it("rejects unknown artifacts, taken ids, and malformed ids", () => {
    const unknown = appendTraceEdge(WITH_TRACE, {
      artifactId: "REQ-NOPE",
      uri: "src/a.ts",
      type: "implements",
    });
    expect(unknown.ok).toBe(false);

    const taken = appendTraceEdge(WITH_TRACE, {
      artifactId: "REQ-A",
      uri: "src/a.ts",
      type: "implements",
      edgeId: "E-SAT",
    });
    expect(taken.ok).toBe(false);

    const malformed = appendTraceEdge(WITH_TRACE, {
      artifactId: "REQ-A",
      uri: "src/a.ts",
      type: "implements",
      edgeId: "0bad id",
    });
    expect(malformed.ok).toBe(false);
  });

  it("escapes attribute values in the generated edge", () => {
    const result = appendTraceEdge(WITH_TRACE, {
      artifactId: "REQ-A",
      uri: 'src/a"&<>.ts',
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
    const request = { artifactId: "REQ-A", uri: "src/a.ts", type: "implements" as const };
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
      artifactId: "REQ-A",
      uri,
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
});
