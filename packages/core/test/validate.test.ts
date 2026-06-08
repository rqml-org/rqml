import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validate } from "../src/validate/index.js";

const fixture = readFileSync(
  fileURLToPath(new URL("./fixtures/rqml-core.rqml", import.meta.url)),
  "utf8",
);

describe("validate", () => {
  it("accepts the rqml-core requirements document", () => {
    const result = validate(fixture);
    expect(result.diagnostics).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.schemaVersion).toBe("2.1.0");
  });

  it("reports schema violations as diagnostics", () => {
    const bad = fixture.replace('status="draft"', 'status="bogus"');
    const result = validate(bad);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0]?.source).toBe("validate");
  });

  it("errors on an unsupported schema version", () => {
    const result = validate(fixture, { schemaVersion: "9.9.9" });
    expect(result.valid).toBe(false);
    expect(result.diagnostics[0]?.message).toContain("No bundled schema");
  });
});
