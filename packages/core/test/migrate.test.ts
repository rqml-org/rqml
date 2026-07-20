import { describe, expect, it } from "vitest";
import { migrateDocument } from "../src/edit/migrate.js";
import { parse } from "../src/parse/parse.js";
import { validate } from "../src/validate/index.js";

const SOURCE_210 = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="https://rqml.org/schema/2.1.0 https://rqml.org/schema/rqml-2.1.0.xsd" version="2.1.0" docId="MIG-1" status="draft">
  <meta><title>t</title><system>s</system></meta>
  <goals>
    <!-- goals comment that must survive -->
    <goal id="G1" title="g"><statement>s</statement></goal>
  </goals>
  <requirements>
    <req id="REQ-A" type="FR" title="r" status="approved"><statement>s</statement></req>
  </requirements>
  <trace>
    <!-- ___ a section comment between edges ___ -->
    <edge id="E-1" type="satisfies" confidence="0.9">
      <from><locator><local id="REQ-A"/></locator></from>
      <to><locator><local id="G1"/></locator></to>
    </edge>
    <edge id="E-2" type="dependsOn">
      <from><locator><local id="REQ-A"/></locator></from>
      <to><locator><doc uri="auth.rqml" docId="AUTH-1" id="REQ-X" version="2.1.0"/></locator></to>
    </edge>
    <edge id="E-3" type="implements" status="draft" createdBy="rqml">
      <from><locator><external uri="packages/core/src/a.ts#f" kind="code"/></locator></from>
      <to><locator><local id="REQ-A"/></locator></to>
      <notes>kept <em>verbatim</em></notes>
    </edge>
  </trace>
</rqml>`;

describe("migrateDocument (REQ-LOOP-MIGRATE)", () => {
  it("migrates 2.1.0 to 2.2.0 preserving everything outside root tag and edges (CRIT-MIGRATE-ROUNDTRIP)", () => {
    const result = migrateDocument(SOURCE_210);
    if (!result.ok) throw new Error(result.error);
    expect(result.changed).toBe(true);
    expect(result.edgesRewritten).toBe(3);

    // Validates against the target schema.
    const validation = validate(result.xml);
    expect(validation.diagnostics).toEqual([]);
    expect(validation.valid).toBe(true);

    // Identical trace model.
    const before = parse(SOURCE_210);
    const after = parse(result.xml);
    if (!before.ok || !after.ok) throw new Error("round-trip did not parse");
    expect(after.document.trace).toEqual(before.document.trace);
    expect(after.document.version).toBe("2.2.0");

    // Comments and hand formatting survive; notes markup survives verbatim.
    expect(result.xml).toContain("goals comment that must survive");
    expect(result.xml).toContain("___ a section comment between edges ___");
    expect(result.xml).toContain("kept <em>verbatim</em>");

    // Only the root tag and the trace edges changed.
    expect(result.xml).toContain(
      '<edge id="E-1" type="satisfies" from="REQ-A" to="G1" confidence="0.9"/>',
    );
    expect(result.xml).toContain('to="rqml:auth.rqml#REQ-X;version=2.1.0;docId=AUTH-1"');
    expect(result.xml).not.toContain("<locator>");
    const stripDynamic = (xml: string) =>
      xml
        .split("\n")
        .filter(
          (line) =>
            !/rqml\.org\/schema|<\/?edge|<from>|<to>|<locator|<notes|verbatim/.test(line),
        )
        .join("\n");
    expect(stripDynamic(result.xml)).toBe(stripDynamic(SOURCE_210));
  });

  it("is idempotent: a 2.2.0 document is returned unchanged", () => {
    const first = migrateDocument(SOURCE_210);
    if (!first.ok) throw new Error(first.error);
    const second = migrateDocument(first.xml);
    if (!second.ok) throw new Error(second.error);
    expect(second.changed).toBe(false);
    expect(second.xml).toBe(first.xml);
  });

  it("never rewrites edge text inside XML comments; the live edge migrates", () => {
    const withComment = SOURCE_210.replace(
      "<!-- ___ a section comment between edges ___ -->",
      `<!-- disabled for now:
    <edge id="E-1" type="satisfies">
      <from><locator><local id="REQ-A"/></locator></from>
      <to><locator><local id="G1"/></locator></to>
    </edge>
    -->`,
    );
    const result = migrateDocument(withComment);
    if (!result.ok) throw new Error(result.error);
    // The commented-out copy is byte-identical; the live edge is compact.
    expect(result.xml).toContain(`<!-- disabled for now:
    <edge id="E-1" type="satisfies">
      <from><locator><local id="REQ-A"/></locator></from>`);
    expect(result.xml).toContain(
      '<edge id="E-1" type="satisfies" from="REQ-A" to="G1" confidence="0.9"/>',
    );
    expect(validate(result.xml).valid).toBe(true);
  });

  it("migrates ./-prefixed external uris (armor normalized into the model)", () => {
    const dotted = SOURCE_210.replace(
      'uri="packages/core/src/a.ts#f"',
      'uri="./src/auth.ts"',
    );
    const result = migrateDocument(dotted);
    if (!result.ok) throw new Error(result.error);
    expect(result.xml).toContain('from="src/auth.ts"');
    expect(validate(result.xml).valid).toBe(true);
  });

  it("rewrites a single-quoted version attribute", () => {
    const singleQuoted = SOURCE_210.replace('version="2.1.0"', "version='2.1.0'");
    const result = migrateDocument(singleQuoted);
    if (!result.ok) throw new Error(result.error);
    expect(result.xml).toContain('version="2.2.0"');
    expect(validate(result.xml).valid).toBe(true);
  });

  it("refuses unknown versions and duplicate edge ids", () => {
    const unknown = migrateDocument(SOURCE_210.replaceAll("2.1.0", "9.9.9"));
    expect(unknown.ok).toBe(false);

    const dup = migrateDocument(SOURCE_210.replaceAll('id="E-2"', 'id="E-1"'));
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error).toContain("duplicate edge id");
  });
});
