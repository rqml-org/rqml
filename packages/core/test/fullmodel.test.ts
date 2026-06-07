import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "../src/parse/parse.js";
import { serialize } from "../src/parse/serialize.js";
import { getRawSections } from "../src/parse/raw.js";

const examplesDir = fileURLToPath(
  new URL("../../schema/examples/", import.meta.url),
);
const localFixture = fileURLToPath(
  new URL("./fixtures/rqml-core.rqml", import.meta.url),
);

const docs: Array<{ name: string; xml: string }> = readdirSync(examplesDir)
  .filter((f) => f.endsWith(".rqml"))
  .sort()
  .map((f) => ({ name: f, xml: readFileSync(examplesDir + f, "utf8") }));
docs.push({ name: "rqml-core.rqml", xml: readFileSync(localFixture, "utf8") });

function parseOk(xml: string, label: string) {
  const r = parse(xml);
  if (!r.ok) throw new Error(`parse ${label} failed: ${r.error.message}`);
  return r.document;
}

describe("full-model round-trip", () => {
  for (const { name, xml } of docs) {
    it(`round-trips ${name} with model equality`, () => {
      const first = parseOk(xml, name);
      const second = parseOk(serialize(first), `reparse ${name}`);
      expect(second).toEqual(first);
    });

    it(`leaves the raw stash empty for ${name} (all content modeled)`, () => {
      const doc = parseOk(xml, name);
      expect(getRawSections(doc) ?? {}).toEqual({});
    });
  }
});

describe("section completeness (carrental)", () => {
  const carrental = docs.find((d) => d.name === "carrental.rqml");
  if (!carrental) throw new Error("carrental.rqml fixture missing");
  const doc = parseOk(carrental.xml, "carrental");

  it("models every optional section present in the richest fixture", () => {
    expect(doc.catalogs).toBeDefined();
    expect(doc.domain).toBeDefined();
    expect(doc.goals).toBeDefined();
    expect(doc.scenarios).toBeDefined();
    expect(doc.behavior).toBeDefined();
    expect(doc.interfaces).toBeDefined();
    expect(doc.verification).toBeDefined();
    expect(doc.governance).toBeDefined();
  });

  it("parses a boolean attr/@required as a real boolean", () => {
    const attrs = (doc.domain?.entities ?? []).flatMap((e) => e.attrs ?? []);
    const required = attrs.find((a) => a.required === true);
    expect(required).toBeDefined();
    // Every materialized value is a real boolean, never a string.
    for (const a of attrs) {
      if (a.required !== undefined) expect(typeof a.required).toBe("boolean");
    }
  });

  it("reads the state/@type enum and keeps the property iff defined", () => {
    const states = (doc.behavior?.stateMachines ?? []).flatMap((m) => m.states);
    expect(states.length).toBeGreaterThan(0);
    expect(states.some((s) => s.type === "initial")).toBe(true);
    expect(states.some((s) => s.type === "normal")).toBe(true);
    expect(states.some((s) => s.type === "final")).toBe(true);
    for (const s of states) {
      expect(Object.prototype.hasOwnProperty.call(s, "type")).toBe(
        s.type !== undefined,
      );
    }
  });

  it("populates nested endpoints, states, and transitions", () => {
    const sm = doc.behavior?.stateMachines?.[0];
    expect(sm).toBeDefined();
    expect((sm?.states ?? []).length).toBeGreaterThan(0);
    expect((sm?.transitions ?? []).length).toBeGreaterThan(0);
    const api = doc.interfaces?.apis?.[0];
    expect(api).toBeDefined();
    expect((api?.endpoints ?? []).length).toBeGreaterThan(0);
  });

  it("models trace-edge metadata and locator hints", () => {
    const withTags = doc.trace.find((e) => (e.tags?.length ?? 0) > 0);
    expect(withTags).toBeDefined();
    expect(Array.isArray(withTags?.tags)).toBe(true);
    expect(doc.trace.some((e) => e.status !== undefined)).toBe(true);
    expect(doc.trace.some((e) => e.createdBy !== undefined)).toBe(true);
    expect(doc.trace.some((e) => e.createdAt !== undefined)).toBe(true);

    const docLocator = doc.trace
      .flatMap((e) => [e.from, e.to])
      .find((l) => l.kind === "doc");
    expect(docLocator).toBeDefined();
    if (docLocator?.kind === "doc") {
      expect(docLocator.docId).toBeDefined();
      expect(docLocator.version).toBeDefined();
    }
    expect(doc.trace.some((e) => e.from.kind === "external" || e.to.kind === "external")).toBe(true);
  });
});

// carrental's states all carry an explicit @type and its doc locator has no
// git, so the omit-when-absent and git-round-trip paths need a handcrafted doc.
const EDGE_CASES = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="EDGE-001" status="draft">
  <meta><title>t</title><system>s</system><authors><author name="A"/></authors></meta>
  <requirements><req id="R1" type="FR" title="One"><statement>S</statement></req></requirements>
  <behavior>
    <stateMachine id="SM1" name="M" initial="S-A">
      <state id="S-A" name="A" type="initial"/>
      <state id="S-B" name="B"/>
      <transition id="TR1" from="S-A" to="S-B"/>
    </stateMachine>
  </behavior>
  <trace>
    <edge id="E1" type="dependsOn">
      <from><locator><local id="R1"/></locator></from>
      <to><locator><doc uri="other.rqml" id="X1" docId="OTHER" version="2.0.0" git="abc123"/></locator></to>
    </edge>
  </trace>
</rqml>`;

describe("model edge cases (handcrafted)", () => {
  const doc = parseOk(EDGE_CASES, "edge-cases");

  it("omits state/@type when absent (XSD default never materialized)", () => {
    const states = doc.behavior?.stateMachines?.[0]?.states ?? [];
    const a = states.find((s) => s.id === "S-A");
    const b = states.find((s) => s.id === "S-B");
    expect(a?.type).toBe("initial");
    expect(b?.type).toBeUndefined();
    expect(b && Object.prototype.hasOwnProperty.call(b, "type")).toBe(false);
  });

  it("round-trips a doc locator's git/docId/version", () => {
    const loc = doc.trace[0]?.to;
    expect(loc).toEqual({
      kind: "doc",
      uri: "other.rqml",
      id: "X1",
      docId: "OTHER",
      version: "2.0.0",
      git: "abc123",
    });
    const reparsed = parseOk(serialize(doc), "edge-cases reparse");
    expect(reparsed).toEqual(doc);
  });
});
