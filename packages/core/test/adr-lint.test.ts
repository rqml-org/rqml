import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { citationsInField, isRetiredRecord, lintAdrReferences } from "../src/lint/adr.js";
import { lint } from "../src/lint/index.js";
import { parse } from "../src/parse/parse.js";

/**
 * REQ-CORE-ADR-REFS. The exclusions carry most of the weight here: an audit of
 * the real corpus found 2 genuine dangling references against 28 correct
 * citations, so every false-positive class below is a case that actually
 * occurred and would have made the rule unusable.
 */

const SPEC = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.2.0" version="2.2.0" docId="ADR-LINT-1" status="draft">
  <meta><title>t</title><system>s</system></meta>
  <goals><goal id="GOAL-ONE" title="g"><statement>s</statement></goal></goals>
  <requirements>
    <req id="REQ-KEPT" type="FR" title="r" status="approved">
      <statement>s</statement>
      <acceptance><criterion id="CRIT-KEPT"><given>g</given><when>w</when><then>t</then></criterion></acceptance>
    </req>
    <req id="REQ-ALSO-KEPT" type="FR" title="r" status="approved">
      <statement>s</statement>
      <acceptance><criterion id="CRIT-ALSO"><given>g</given><when>w</when><then>t</then></criterion></acceptance>
    </req>
  </requirements>
</rqml>`;

describe("ADR reference lint (REQ-CORE-ADR-REFS)", () => {
  let dir: string;
  let adrDir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rqml-adr-"));
    adrDir = join(dir, ".rqml", "adr");
    mkdirSync(adrDir, { recursive: true });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const doc = () => {
    const p = parse(SPEC);
    if (!p.ok) throw new Error("fixture did not parse");
    return p.document;
  };
  const adr = (name: string, body: string) => writeFileSync(join(adrDir, name), body);
  const run = () => lintAdrReferences(doc(), { adrDir });

  it("reports a dangling id in Related requirements (CRIT-ADR-REF-DANGLING)", () => {
    adr(
      "0001-a.md",
      "# ADR-0001: t\n\n- Status: Accepted\n- Related requirements: REQ-KEPT, REQ-GONE\n",
    );
    const found = run();
    expect(found).toHaveLength(1);
    expect(found[0]?.rule).toBe("unresolved-adr-reference");
    expect(found[0]?.message).toContain("REQ-GONE");
    expect(found[0]?.message).not.toContain("REQ-KEPT");
    expect(found[0]?.line).toBe(4);
  });

  it("reads both header formats and the Decision ID field", () => {
    adr(
      "0001-bold.md",
      "# t\n\n- **Status**: Accepted\n- **Decision ID** (in `requirements.rqml`): `DEC-GONE`\n" +
        "- **Related requirements**: `REQ-KEPT`, `REQ-MISSING`\n",
    );
    // DEC-* is not a prefix this document declares, so it is not an id here;
    // REQ-MISSING is.
    const msgs = run().map((d) => d.message);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain("REQ-MISSING");
  });

  it("ignores superseded and rejected records (CRIT-ADR-REF-EXCLUSIONS)", () => {
    adr(
      "0001-old.md",
      "# t\n\n- **Status**: Superseded by [ADR-0008](0008-x.md)\n- **Related requirements**: `REQ-RETIRED`\n",
    );
    adr("0002-no.md", "# t\n\n- Status: Rejected\n- Related requirements: REQ-NEVER\n");
    expect(run()).toEqual([]);
  });

  it("ignores an id the author qualified with a parenthetical (CRIT-ADR-REF-EXCLUSIONS)", () => {
    adr(
      "0001-x.md",
      "# t\n\n- Status: Accepted\n" +
        "- Related requirements: REQ-KEPT, REQ-ELSEWHERE (rqml-claude, rqml-codex)\n",
    );
    expect(run()).toEqual([]);
  });

  it("ignores body prose, historical citations and examples", () => {
    adr(
      "0001-x.md",
      "# t\n\n- Status: Accepted\n- Related requirements: REQ-KEPT\n\n" +
        "## Context\n\nThey came from the former `core.rqml` (`REQ-SERIALIZE`, `REQ-ROUNDTRIP`).\n" +
        "The vscode extension adapts it (rqml-vscode REQ-MAT-DELEGATE).\n\n" +
        '```xml\n<edge id="E-1" type="satisfies" from="REQ-A" to="GOAL-B"/>\n```\n' +
        'Inline `from="REQ-A" to="GOAL-B"` is an example too.\n',
    );
    expect(run()).toEqual([]);
  });

  it("is silent when the project has no ADR directory", () => {
    expect(lintAdrReferences(doc(), { adrDir: join(dir, "nope") })).toEqual([]);
    expect(lint(doc(), { adrDir: join(dir, "nope") })).toEqual([]);
  });

  it("skips README.md and is deterministic across runs", () => {
    adr("README.md", "- Related requirements: REQ-INDEX-NOT-A-RECORD\n");
    adr("0002-b.md", "# t\n\n- Status: Accepted\n- Related requirements: REQ-B-GONE\n");
    adr("0001-a.md", "# t\n\n- Status: Accepted\n- Related requirements: REQ-A-GONE\n");
    const first = run();
    expect(first.map((d) => d.message.split(" ")[0])).toEqual(["0001-a.md", "0002-b.md"]);
    expect(run()).toEqual(first);
  });

  it("only runs through lint() when a directory is supplied, and scales with strictness", () => {
    adr("0001-a.md", "# t\n\n- Status: Accepted\n- Related requirements: REQ-GONE\n");
    expect(lint(doc())).toEqual([]); // no adrDir: in-memory callers unaffected
    expect(lint(doc(), { adrDir }).map((d) => d.severity)).toEqual(["warning"]);
    expect(lint(doc(), { adrDir, strictness: "strict" }).map((d) => d.severity)).toEqual([
      "error",
    ]);
    expect(lint(doc(), { adrDir, strictness: "lenient" }).map((d) => d.severity)).toEqual(
      ["info"],
    );
  });
});

describe("citation parsing", () => {
  it("treats parentheses as the annotation channel, both directions", () => {
    expect(citationsInField("REQ-A, REQ-B (rqml-claude, rqml-codex)")).toEqual([
      { id: "REQ-A", qualified: false },
      { id: "REQ-B", qualified: true },
    ]);
    // ids that appear only inside a parenthetical are commentary, not citations
    expect(citationsInField("REQ-A (see also REQ-HIDDEN)")).toEqual([
      { id: "REQ-A", qualified: true },
    ]);
  });

  it("survives the real multi-clause prose line from ADR-0012", () => {
    const value =
      "REQ-CORE-SPEC-DISCOVERY, REQ-WORKSPACE-FANOUT (drafted alongside this ADR); " +
      "SCN-AUTHOR (revised to the per-unit / nearest-wins model); " +
      "REQ-AGENTS-TEMPLATE (the AGENTS.md template content it governs)";
    expect(citationsInField(value)).toEqual([
      { id: "REQ-CORE-SPEC-DISCOVERY", qualified: false },
      { id: "REQ-WORKSPACE-FANOUT", qualified: true },
      { id: "SCN-AUTHOR", qualified: true },
      { id: "REQ-AGENTS-TEMPLATE", qualified: true },
    ]);
  });

  it("strips backticks and ignores lower-case and unhyphenated words", () => {
    expect(citationsInField("`REQ-A`, `QGOAL-DIFF`").map((c) => c.id)).toEqual([
      "REQ-A",
      "QGOAL-DIFF",
    ]);
    expect(citationsInField("see the AGENTS.md template, nearest-wins")).toEqual([]);
  });

  it("reads the record status field in either format", () => {
    expect(isRetiredRecord("- **Status**: Superseded by ADR-0008")).toBe(true);
    expect(isRetiredRecord("- Status: Rejected")).toBe(true);
    expect(isRetiredRecord("- Status: Accepted")).toBe(false);
    expect(isRetiredRecord("# no status at all")).toBe(false);
    // the FIRST status line wins: prose mentioning supersession must not retire it
    expect(
      isRetiredRecord("- Status: Accepted\n\nThis supersedes nothing and rejects none."),
    ).toBe(false);
  });
});
