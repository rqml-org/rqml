import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCheck } from "../src/commands/check.js";
import { runStatus } from "../src/commands/status.js";
import { EXIT, parseArgs } from "../src/runtime.js";
import { runWorkspace } from "../src/workspace.js";

/** A minimal, schema-valid spec that passes the gate (no implements edges). */
const cleanSpec = (docId: string) => `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="${docId}" status="draft">
  <meta><title>${docId}</title><system>${docId}</system></meta>
  <requirements>
    <req id="REQ-${docId}" type="FR" title="r" status="approved"><statement>It SHALL work.</statement></req>
  </requirements>
</rqml>`;

/** A schema-valid spec whose implements edge points at a missing file → drift → gate fails. */
const driftedSpec = (docId: string) => `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="${docId}" status="draft">
  <meta><title>${docId}</title><system>${docId}</system></meta>
  <requirements>
    <req id="REQ-${docId}" type="FR" title="r" status="approved"><statement>It SHALL work.</statement></req>
  </requirements>
  <trace>
    <edge id="E-IMPL-${docId}" type="implements">
      <from><locator><external uri="file:src/gone.ts"/></locator></from>
      <to><locator><local id="REQ-${docId}"/></locator></to>
    </edge>
  </trace>
</rqml>`;

/** Capture stdout writes into a buffer that survives `restore()`. */
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

describe("workspace fan-out (REQ-WORKSPACE-FANOUT)", () => {
  let repo: string;
  const aSpec = () => join(repo, "packages", "a", "requirements.rqml");
  const bSpec = () => join(repo, "packages", "b", "requirements.rqml");

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "rqml-ws-"));
    mkdirSync(join(repo, ".git"));
    mkdirSync(join(repo, "packages", "a"), { recursive: true });
    mkdirSync(join(repo, "packages", "b"), { recursive: true });
    writeFileSync(aSpec(), cleanSpec("WSA"));
    writeFileSync(bSpec(), driftedSpec("WSB"));
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it("checks every unit and exits non-zero, naming the failing unit (CRIT-FANOUT-EXIT)", async () => {
    const cap = captureStdout();
    const code = await runCheck(["--workspace", "--base-dir", repo, "--json"]);
    cap.restore();

    expect(code).toBe(EXIT.CHECK);
    const report = JSON.parse(cap.text());
    expect(report.command).toBe("check");
    expect(report.verdict).toBe("fail");
    expect(report.units.map((u: { path: string }) => u.path).sort()).toEqual(
      [aSpec(), bSpec()].sort(),
    );
    const failing = report.units
      .filter((u: { code: number }) => u.code !== EXIT.OK)
      .map((u: { path: string }) => u.path);
    expect(failing).toEqual([bSpec()]);
  });

  it("passes (exit 0) when every unit passes", async () => {
    writeFileSync(bSpec(), cleanSpec("WSB"));
    const cap = captureStdout();
    const code = await runCheck(["--workspace", "--base-dir", repo]);
    cap.restore();
    expect(code).toBe(EXIT.OK);
  });

  it("status --workspace summarizes every unit and stays OK", async () => {
    const cap = captureStdout();
    const code = await runStatus(["--workspace", "--base-dir", repo, "--json"]);
    cap.restore();
    expect(code).toBe(EXIT.OK);
    const report = JSON.parse(cap.text());
    expect(report.units).toHaveLength(2);
  });

  it("honors --ignore to skip a unit directory", async () => {
    const cap = captureStdout();
    const code = await runCheck([
      "--workspace",
      "--base-dir",
      repo,
      "--ignore",
      "b",
      "--json",
    ]);
    cap.restore();
    expect(code).toBe(EXIT.OK); // the drifted unit b is skipped
    const report = JSON.parse(cap.text());
    expect(report.units).toHaveLength(1);
    expect(report.units[0].path).toBe(aSpec());
  });

  it("turns a per-unit runner throw into a failing unit, not an abort", async () => {
    writeFileSync(aSpec(), cleanSpec("WSA"));
    writeFileSync(bSpec(), cleanSpec("WSB"));
    const args = parseArgs(["--workspace", "--base-dir", repo, "--json"]);
    const cap = captureStdout();
    const code = await runWorkspace("check", args, (specPath) => {
      if (specPath === bSpec()) throw new Error("boom");
      return { code: EXIT.OK, json: { path: specPath }, human: "" };
    });
    cap.restore();
    expect(code).toBe(EXIT.VALIDATION);
    const report = JSON.parse(cap.text());
    expect(report.units).toHaveLength(2);
    const b = report.units.find((u: { path: string }) => u.path === bSpec());
    expect(b.code).toBe(EXIT.VALIDATION);
  });

  it("errors on a nonexistent workspace root rather than passing as empty", async () => {
    await expect(
      runCheck(["--workspace", "--base-dir", join(repo, "does-not-exist")]),
    ).rejects.toThrow(/not a directory/);
  });
});
