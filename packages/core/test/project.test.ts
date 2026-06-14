import { describe, expect, it } from "vitest";
import { buildOutline } from "../src/export/outline.js";
import { projectOutline } from "../src/export/project.js";
import { parse } from "../src/parse/parse.js";

const DOC = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="PROJTEST-1" status="draft">
  <meta><title>t</title><system>s</system></meta>
  <goals>
    <goal id="GOAL-A" title="Goal A" priority="must"><statement>A.</statement></goal>
  </goals>
  <requirements>
    <reqPackage id="PKG-X" title="Package X">
      <req id="REQ-1" type="FR" title="One" status="approved"><statement>one SHALL.</statement></req>
      <req id="REQ-2" type="FR" title="Two" status="draft"><statement>two SHALL.</statement></req>
    </reqPackage>
  </requirements>
</rqml>`;

function outline() {
  const r = parse(DOC);
  if (!r.ok) throw new Error(`fixture failed to parse: ${r.error.message}`);
  return buildOutline(r.document);
}

describe("projectOutline (REQ-CORE-PROJECTION)", () => {
  it("returns the whole outline unchanged with no filter", () => {
    const o = outline();
    expect(projectOutline(o)).toEqual(o);
  });

  it("keeps only named sections (case-insensitive)", () => {
    const p = projectOutline(outline(), { sections: ["goals"] });
    expect(p.sections.map((s) => s.title)).toEqual(["Goals"]);
  });

  it("keeps a single requirement by id, inside its package wrapper", () => {
    const p = projectOutline(outline(), { ids: ["REQ-2"] });
    expect(p.sections.map((s) => s.title)).toEqual(["Requirements"]);
    const pkg = p.sections[0]?.children?.[0];
    expect(pkg?.id).toBe("PKG-X");
    expect(pkg?.children?.map((c) => c.id)).toEqual(["REQ-2"]);
  });

  it("keeps a whole package by its id", () => {
    const p = projectOutline(outline(), { ids: ["PKG-X"] });
    const pkg = p.sections[0]?.children?.[0];
    expect(pkg?.children?.map((c) => c.id)).toEqual(["REQ-1", "REQ-2"]);
  });
});
