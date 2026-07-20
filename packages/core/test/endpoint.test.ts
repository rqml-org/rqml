import { describe, expect, it } from "vitest";
import {
  formatConfidence,
  formatEndpointRef,
  parseEndpointRef,
} from "../src/trace/endpoint.js";

describe("endpoint micro-syntax (RFC-0003)", () => {
  it("classifies bare ids as local", () => {
    const result = parseEndpointRef("REQ-A");
    expect(result).toEqual({ ok: true, locator: { kind: "local", id: "REQ-A" } });
  });

  it("classifies scheme URIs and relative paths as external", () => {
    for (const uri of [
      "file:src/a.ts#L10",
      "jira:PROJ-1",
      "urn:gdpr:article:17",
      "https://example.com/x",
      "packages/core/src/edit/link.ts#runLink",
    ]) {
      const result = parseEndpointRef(uri);
      expect(result).toEqual({ ok: true, locator: { kind: "external", uri } });
    }
  });

  it("treats a leading ./ as syntactic armor, keeping format→parse model-stable", () => {
    // Slashless uris get "./" on format; parse strips it again.
    expect(parseEndpointRef("./a.ts")).toEqual({
      ok: true,
      locator: { kind: "external", uri: "a.ts" },
    });
    expect(formatEndpointRef({ kind: "external", uri: "tsconfig.base.json" })).toBe(
      "./tsconfig.base.json",
    );
    const back = parseEndpointRef("./tsconfig.base.json");
    expect(back).toEqual({
      ok: true,
      locator: { kind: "external", uri: "tsconfig.base.json" },
    });
    // "../" keeps its meaning.
    expect(parseEndpointRef("../shared/a.ts")).toEqual({
      ok: true,
      locator: { kind: "external", uri: "../shared/a.ts" },
    });
  });

  it("parses doc locators with pins, splitting at the last #", () => {
    const result = parseEndpointRef(
      "rqml:https://host/spec.rqml?ref=a#b#REQ-X;version=2.1.0;git=a1b2;docId=DOC-1",
    );
    expect(result).toEqual({
      ok: true,
      locator: {
        kind: "doc",
        uri: "https://host/spec.rqml?ref=a#b",
        id: "REQ-X",
        version: "2.1.0",
        git: "a1b2",
        docId: "DOC-1",
      },
    });
  });

  it("rejects malformed doc locators instead of coercing to external", () => {
    for (const value of [
      "rqml:auth.rqml", // no fragment
      "rqml:#REQ-X", // no doc uri
      "rqml:auth.rqml#not an id",
      "rqml:auth.rqml#REQ-X;unknown=1",
      "rqml:auth.rqml#REQ-X;version=1;version=2",
      "rqml:auth.rqml#REQ-X;docId=has space",
    ]) {
      const result = parseEndpointRef(value);
      expect(result.ok, value).toBe(false);
    }
  });

  it("rejects empty and unclassifiable values", () => {
    expect(parseEndpointRef("").ok).toBe(false);
    expect(parseEndpointRef("has space").ok).toBe(false);
    expect(parseEndpointRef("src/a b.ts").ok).toBe(false);
  });

  it("round-trips every locator kind through format", () => {
    for (const value of [
      "REQ-A",
      "file:src/a.ts#L10",
      "packages/core/src/a.ts",
      "rqml:auth.rqml#REQ-X;version=2.1.0;git=a1b2;docId=D-1",
    ]) {
      const parsed = parseEndpointRef(value);
      if (!parsed.ok) throw new Error(parsed.error);
      expect(formatEndpointRef(parsed.locator)).toBe(value);
    }
  });

  it("guards slashless schemeless external uris with ./ on format", () => {
    expect(formatEndpointRef({ kind: "external", uri: "a.ts" })).toBe("./a.ts");
  });

  it("formats confidence as plain decimal, never exponential", () => {
    expect(formatConfidence(0.9)).toBe("0.9");
    expect(formatConfidence(1)).toBe("1");
    expect(formatConfidence(1e-7)).toBe("0.0000001");
    expect(formatConfidence(0.0000001)).toBe("0.0000001");
  });
});
