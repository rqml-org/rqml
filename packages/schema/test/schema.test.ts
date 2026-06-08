import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCHEMA_VERSION,
  SCHEMA_VERSIONS,
  isSchemaVersion,
  resolveSchema,
  schemaNamespace,
  schemaUrl,
  supportedSchemaVersions,
} from "../src/index.js";

describe("@rqml/schema", () => {
  it("resolves every supported version to inlined XSD text", () => {
    for (const v of SCHEMA_VERSIONS) {
      const xsd = resolveSchema(v);
      expect(typeof xsd).toBe("string");
      expect(xsd).toContain("schema");
    }
  });

  // Provenance: the inlined string MUST be byte-identical to the canonical
  // versions/ file. This replaces the old upstream-fetch provenance check
  // (REQ-PROVENANCE) now that there is a single source (REQ-SCHEMA-CANONICAL).
  it("inlined text is byte-identical to the canonical versions/ file", () => {
    for (const v of SCHEMA_VERSIONS) {
      const disk = readFileSync(
        fileURLToPath(new URL(`../versions/${v}/rqml-${v}.xsd`, import.meta.url)),
        "utf8",
      );
      expect(resolveSchema(v)).toBe(disk);
    }
  });

  it("returns undefined for an unknown version", () => {
    expect(resolveSchema("9.9.9")).toBeUndefined();
    expect(isSchemaVersion("9.9.9")).toBe(false);
  });

  it("default version is supported", () => {
    expect(supportedSchemaVersions()).toContain(DEFAULT_SCHEMA_VERSION);
    expect(isSchemaVersion(DEFAULT_SCHEMA_VERSION)).toBe(true);
  });

  it("exposes the stable published namespace + URL contract", () => {
    expect(schemaNamespace("2.1.0")).toBe("https://rqml.org/schema/2.1.0");
    // Flat URL form — the immutable schemaLocation contract.
    expect(schemaUrl("2.1.0")).toBe("https://rqml.org/schema/rqml-2.1.0.xsd");
  });
});
