import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { allRequirements } from "../src/model/types.js";
import { parse } from "../src/parse/parse.js";
import { serialize } from "../src/parse/serialize.js";

const fixture = readFileSync(
  fileURLToPath(new URL("./fixtures/rqml-core.rqml", import.meta.url)),
  "utf8",
);

function parseOk(xml: string) {
  const result = parse(xml);
  if (!result.ok) throw new Error(`expected parse to succeed: ${result.error.message}`);
  return result.document;
}

describe("parse", () => {
  it("maps the requirements document into the typed model", () => {
    const doc = parseOk(fixture);
    expect(doc.version).toBe("2.1.0");
    expect(doc.docId).toBe("RQML-CORE-001");
    expect(doc.status).toBe("draft");
    expect(doc.meta.title).not.toBe("");
    expect(doc.packages.length).toBeGreaterThan(0);
    expect(allRequirements(doc).length).toBeGreaterThan(0);
    expect(doc.trace.length).toBeGreaterThan(0);
  });

  it("returns a structured diagnostic for malformed XML instead of throwing", () => {
    const result = parse("<rqml><meta></rqml>");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.source).toBe("parse");
      expect(result.error.severity).toBe("error");
      expect(result.error.message).not.toBe("");
    }
  });

  it("preserves the document across a parse -> serialize -> parse round-trip", () => {
    const first = parseOk(fixture);
    const second = parseOk(serialize(first));

    expect(second.version).toBe(first.version);
    expect(second.docId).toBe(first.docId);
    expect(second.status).toBe(first.status);
    expect(second.meta).toEqual(first.meta);
    expect(allRequirements(second)).toEqual(allRequirements(first));
    expect(second.trace).toEqual(first.trace);
  });

  it("round-trips structured trace locators", () => {
    const doc = parseOk(fixture);
    const local = doc.trace.find((e) => e.from.kind === "local");
    expect(local).toBeDefined();
    const reparsed = parseOk(serialize(doc));
    expect(reparsed.trace).toEqual(doc.trace);
  });
});
