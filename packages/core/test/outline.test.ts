import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "../src/parse/parse.js";
import { buildOutline } from "../src/export/outline.js";
import { outlineToMarkdown, toMarkdown } from "../src/export/markdown.js";
import type { RqmlDocument } from "../src/model/types.js";

const carrental = readFileSync(
  fileURLToPath(new URL("../../schema/examples/carrental.rqml", import.meta.url)),
  "utf8",
);

function parseOk(xml: string) {
  const r = parse(xml);
  if (!r.ok) throw new Error(`parse failed: ${r.error.message}`);
  return r.document;
}

const small: RqmlDocument = {
  version: "2.1.0",
  docId: "D1",
  status: "draft",
  meta: {
    title: "Tiny Spec",
    system: "Tiny",
    summary: "A tiny spec.",
    authors: [{ name: "A" }],
  },
  goals: {
    goals: [{ id: "G1", title: "Be fast", statement: "The system shall be fast." }],
  },
  packages: [],
  looseRequirements: [
    {
      id: "R1",
      type: "FR",
      title: "Login",
      status: "approved",
      priority: "must",
      statement: "User can log in.",
      acceptance: [{ then: "User is logged in." }],
    },
  ],
  trace: [
    {
      id: "E1",
      type: "satisfies",
      from: { kind: "local", id: "R1" },
      to: { kind: "local", id: "G1" },
    },
  ],
};

describe("buildOutline", () => {
  it("projects every present section of the richest fixture", () => {
    const o = buildOutline(parseOk(carrental));
    expect(o.title).not.toBe("");
    expect(o.system).not.toBe("");
    expect(o.summary).toBeDefined();
    const titles = o.sections.map((s) => s.title);
    for (const expected of [
      "Glossary",
      "Domain",
      "Goals",
      "Scenarios",
      "Requirements",
      "Behavior",
      "Interfaces",
      "Verification",
      "Trace",
      "Governance",
    ]) {
      expect(titles).toContain(expected);
    }
    const reqs = o.sections.find((s) => s.title === "Requirements");
    expect((reqs?.children ?? []).length).toBeGreaterThan(0);
  });

  it("is deterministic", () => {
    const doc = parseOk(carrental);
    expect(JSON.stringify(buildOutline(doc))).toBe(
      JSON.stringify(buildOutline(doc)),
    );
  });

  it("resolves cross-section ref target titles", () => {
    const o = buildOutline(small);
    const reqs = o.sections.find((s) => s.title === "Requirements");
    const r1 = reqs?.children?.[0];
    expect(r1?.refs?.[0]).toEqual({
      relation: "satisfies",
      targetId: "G1",
      resolved: true,
      targetTitle: "Be fast",
    });
  });
});

describe("toMarkdown", () => {
  it("renders a deterministic markdown document", () => {
    const expected = [
      "# Tiny Spec",
      "",
      "- **System:** Tiny",
      "- **Document:** D1 (v2.1.0, draft)",
      "",
      "A tiny spec.",
      "",
      "## Goals",
      "",
      "### Be fast `G1`",
      "",
      "- **Statement:** The system shall be fast.",
      "",
      "## Requirements",
      "",
      "### Login `R1`",
      "",
      "- **Type:** FR",
      "- **Status:** approved",
      "- **Priority:** must",
      "- **Statement:** User can log in.",
      "- _satisfies_ → `G1` (Be fast)",
      "",
      "#### Acceptance criterion",
      "",
      "- **Then:** User is logged in.",
      "",
      "## Trace",
      "",
      "| ID | Type | From | To | Status | Confidence |",
      "| --- | --- | --- | --- | --- | --- |",
      "| E1 | satisfies | R1 (Login) | G1 (Be fast) |  |  |",
      "",
    ].join("\n");
    expect(toMarkdown(small)).toBe(expected);
  });

  it("equals outlineToMarkdown(buildOutline(doc))", () => {
    expect(toMarkdown(small)).toBe(outlineToMarkdown(buildOutline(small)));
  });

  it("renders the richest fixture without throwing and includes a trace table", () => {
    const md = toMarkdown(parseOk(carrental));
    expect(md).toContain("## Trace");
    expect(md).toContain("| ID | Type | From | To | Status | Confidence |");
    expect(md.length).toBeGreaterThan(1000);
  });
});
