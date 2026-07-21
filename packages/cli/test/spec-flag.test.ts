import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * `--spec` names the document a command operates on. It used to be read only
 * by the commands whose positional is an artifact id, so the commands whose
 * positional IS the path silently ignored it and fell back to discovery:
 *
 *   $ rqml validate --spec /path/to/broken.rqml
 *   ✓ requirements.rqml is valid          # exit 0, for a file it never opened
 *
 * A validator reporting success for a document it did not read is the worst
 * failure this CLI can produce, and it is invisible — the output looks exactly
 * like a real pass. Driven through the real binary, because the point is the
 * end-to-end invocation, not the resolver in isolation.
 */

const CLI = fileURLToPath(new URL("../dist/index.js", import.meta.url));

/** Valid, and the spec that discovery would find. */
const GOOD = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.2.0" version="2.2.0" docId="GOOD-1" status="draft">
  <meta><title>good</title><system>s</system></meta>
  <requirements>
    <req id="REQ-GOOD" type="FR" title="r"><statement>s</statement></req>
  </requirements>
</rqml>`;

/** Schema-invalid: <meta> is missing its required <system> child. */
const BROKEN = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.2.0" version="2.2.0" docId="BROKEN-1" status="draft">
  <meta><title>broken</title></meta>
</rqml>`;

/**
 * Valid, but distinguishable from GOOD in every command's output. Commands
 * that report the document rather than the path (`overview` prints the title)
 * need a positive assertion on content — asserting only the absence of
 * "requirements.rqml" would pass whether or not the flag took effect.
 */
const OTHER = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.2.0" version="2.2.0" docId="OTHER-1" status="draft">
  <meta><title>Sentinel Title</title><system>sentinel-system</system></meta>
  <requirements>
    <req id="REQ-SENTINEL" type="FR" title="r"><statement>s</statement></req>
  </requirements>
</rqml>`;

interface Run {
  status: number;
  out: string;
}

function run(dir: string, args: string[]): Run {
  try {
    const out = execFileSync(process.execPath, [CLI, ...args], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, out };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

describe("--spec is honoured, never silently dropped", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rqml-spec-flag-"));
    writeFileSync(join(dir, "requirements.rqml"), GOOD);
    writeFileSync(join(dir, "broken.rqml"), BROKEN);
    writeFileSync(join(dir, "other.rqml"), OTHER);
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  // The regression itself: a broken file named by --spec must fail the run,
  // and the discovered good spec must not be what gets reported.
  it("validate --spec reports the named file, not the discovered one", () => {
    const r = run(dir, ["validate", "--spec", "broken.rqml"]);
    expect(r.out).toContain("broken.rqml");
    expect(r.out).not.toContain("requirements.rqml");
    expect(r.status).not.toBe(0);
  });

  it("check --spec fails on the named file", () => {
    const r = run(dir, ["check", "--spec", "broken.rqml"]);
    expect(r.out).toContain("broken.rqml");
    expect(r.status).not.toBe(0);
  });

  // Positive assertions on content unique to the named document, so these
  // cannot pass by the flag being ignored.
  it.each([
    ["status", "OTHER-1"],
    ["lint", "other.rqml"],
    ["overview", "Sentinel Title"],
  ])("%s --spec reads the named file", (command, marker) => {
    const r = run(dir, [command, "--spec", "other.rqml"]);
    expect(r.out).toContain(marker);
  });

  // The commands whose positional is an artifact id already worked; they must
  // keep working, since --spec now also reaches the shared resolver.
  it("show --spec still resolves the named file", () => {
    const r = run(dir, ["show", "REQ-GOOD", "--spec", "requirements.rqml"]);
    expect(r.status).toBe(0);
    expect(r.out).toContain("REQ-GOOD");
  });

  it("a positional and an equal --spec is not a conflict", () => {
    const r = run(dir, ["validate", "requirements.rqml", "--spec", "requirements.rqml"]);
    expect(r.status).toBe(0);
    expect(r.out).toContain("is valid");
  });

  it("a positional and a different --spec is refused, not silently ranked", () => {
    const r = run(dir, ["validate", "requirements.rqml", "--spec", "broken.rqml"]);
    expect(r.out).toContain("conflicting spec paths");
    expect(r.status).not.toBe(0);
  });

  it("--spec naming a missing file is an error, not a fallback to discovery", () => {
    const r = run(dir, ["validate", "--spec", "nope.rqml"]);
    expect(r.out).toContain("spec file not found");
    expect(r.out).not.toContain("is valid");
    expect(r.status).not.toBe(0);
  });
});
