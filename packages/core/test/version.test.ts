import { describe, expect, it } from "vitest";
import { parse } from "../src/parse/parse.js";
import { serialize } from "../src/parse/serialize.js";

// No 2.0.1 example ships with the schema, so we hand-write the legacy flat-trace
// form: <traceEdge from/to|fromUri/toUri> plus the 2.0.1 actor <goals><ref/></goals>.
const LEGACY_201 = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.0.1" version="2.0.1" docId="LEGACY-001" status="draft">
  <meta>
    <title>Legacy Spec</title>
    <system>Legacy</system>
    <authors><author name="A"/></authors>
  </meta>
  <catalogs>
    <actors>
      <actor id="ACT-1" name="User">
        <goals><ref ref="GOAL-1"/><ref ref="GOAL-2"/></goals>
      </actor>
    </actors>
  </catalogs>
  <requirements>
    <req id="R1" type="FR" title="One"><statement>S1</statement></req>
    <req id="R2" type="FR" title="Two"><statement>S2</statement></req>
  </requirements>
  <trace>
    <traceEdge id="T1" from="R1" to="R2" type="satisfies" confidence="0.9" status="approved" createdBy="me" createdAt="2026-01-01" tags="alpha beta"/>
    <traceEdge id="T2" from="R1" toUri="https://example.com/spec#x" type="dependsOn"/>
  </trace>
</rqml>`;

function parseOk(xml: string, label: string) {
  const r = parse(xml);
  if (!r.ok) throw new Error(`parse ${label} failed: ${r.error.message}`);
  return r.document;
}

describe("version-aware trace (2.0.1 flat form)", () => {
  it("normalizes flat <traceEdge> into typed locators", () => {
    const doc = parseOk(LEGACY_201, "legacy");
    expect(doc.version).toBe("2.0.1");
    expect(doc.trace).toHaveLength(2);

    const t1 = doc.trace[0];
    expect(t1?.from).toEqual({ kind: "local", id: "R1" });
    expect(t1?.to).toEqual({ kind: "local", id: "R2" });
    expect(t1?.confidence).toBe(0.9);
    expect(t1?.status).toBe("approved");
    expect(t1?.createdBy).toBe("me");
    expect(t1?.createdAt).toBe("2026-01-01");
    expect(t1?.tags).toEqual(["alpha", "beta"]);

    const t2 = doc.trace[1];
    expect(t2?.from).toEqual({ kind: "local", id: "R1" });
    expect(t2?.to).toEqual({ kind: "external", uri: "https://example.com/spec#x" });
  });

  it("captures the 2.0.1 actor goal refs", () => {
    const doc = parseOk(LEGACY_201, "legacy");
    expect(doc.catalogs?.actors?.[0]?.goalRefs).toEqual(["GOAL-1", "GOAL-2"]);
  });

  it("serializes a 2.0.1 model with the 2.0.1 namespace and flat <traceEdge>", () => {
    const doc = parseOk(LEGACY_201, "legacy");
    const xml = serialize(doc);
    expect(xml).toContain("https://rqml.org/schema/2.0.1");
    expect(xml).toContain("<traceEdge");
    expect(xml).not.toContain("<edge");
  });

  it("round-trips the 2.0.1 model with full equality", () => {
    const doc = parseOk(LEGACY_201, "legacy");
    const reparsed = parseOk(serialize(doc), "legacy reparse");
    expect(reparsed).toEqual(doc);
  });
});
