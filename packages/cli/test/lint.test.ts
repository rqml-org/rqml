import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runLint } from "../src/commands/lint.js";
import { EXIT } from "../src/runtime.js";

const head = (docId: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="${docId}" status="draft">
  <meta><title>t</title><system>s</system></meta>`;

/** A requirement with no acceptance criteria → a missing-acceptance lint finding. */
const SPEC_NO_ACCEPTANCE = `${head("LINT-1")}
  <requirements>
    <req id="REQ-A" type="FR" title="r" status="approved"><statement>It SHALL work.</statement></req>
  </requirements>
</rqml>`;

/** Every requirement carries acceptance criteria → clean lint. */
const SPEC_CLEAN = `${head("LINT-2")}
  <requirements>
    <req id="REQ-A" type="FR" title="r" status="approved">
      <statement>It SHALL work.</statement>
      <acceptance>
        <criterion id="CRIT-A"><given>g</given><when>w</when><then>t</then></criterion>
      </acceptance>
    </req>
  </requirements>
</rqml>`;

function captureStdout() {
  let buf = "";
  const spy = vi.spyOn(process.stdout, "write").mockImplementation(((
    chunk: string | Uint8Array,
  ) => {
    buf += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
    return true;
  }) as typeof process.stdout.write);
  return { text: () => buf, restore: () => spy.mockRestore() };
}

describe("rqml lint (REQ-CLI-LINT)", () => {
  let dir: string;
  const spec = () => join(dir, "requirements.rqml");

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rqml-lint-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("reports a missing-acceptance error and exits non-zero under --strictness strict (CRIT-LINT-STRICT)", async () => {
    writeFileSync(spec(), SPEC_NO_ACCEPTANCE);
    const cap = captureStdout();
    const code = await runLint([spec(), "--strictness", "strict", "--json"]);
    cap.restore();

    expect(code).toBe(EXIT.VALIDATION);
    const report = JSON.parse(cap.text());
    expect(report.strictness).toBe("strict");
    expect(
      report.findings.some(
        (f: { rule: string; severity: string }) =>
          f.rule === "missing-acceptance" && f.severity === "error",
      ),
    ).toBe(true);
  });

  it("reports no findings and exits zero when acceptance criteria are present (CRIT-LINT-CLEAN)", async () => {
    writeFileSync(spec(), SPEC_CLEAN);
    const cap = captureStdout();
    const code = await runLint([spec(), "--json"]);
    cap.restore();

    expect(code).toBe(EXIT.OK);
    expect(JSON.parse(cap.text()).findings).toEqual([]);
  });

  it("treats the same finding as a non-blocking warning under standard strictness", async () => {
    writeFileSync(spec(), SPEC_NO_ACCEPTANCE);
    const cap = captureStdout();
    const code = await runLint([spec()]); // standard → warning, not error
    cap.restore();
    expect(code).toBe(EXIT.OK);
  });
});
