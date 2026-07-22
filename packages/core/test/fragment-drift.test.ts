import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  computeBaseline,
  decodeBaselineEntry,
  detectDrift,
  encodeBaselineEntry,
} from "../src/check/drift.js";
import {
  canonicalJson,
  fragmentHashAt,
  fragmentMediaType,
  fragmentOf,
  hasDuplicateKeys,
  parseFragmentPointer,
  resolveJsonFragment,
} from "../src/check/fragment.js";
import type { RqmlDocument } from "../src/model/types.js";
import { parse } from "../src/parse/parse.js";

/**
 * REQ-CORE-DRIFT-SCOPE / ADR-0018. The layer's whole value is that it can only
 * ever downgrade an alarm the whole-file hash already raised, so most of what
 * follows checks the cases where it must NOT downgrade: an unresolvable
 * fragment, a media type it does not interpret, a locator with no fragment at
 * all, and a baseline value it does not understand.
 */

const DOC = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.2.0" version="2.2.0" docId="SCOPETEST-1" status="draft">
  <meta>
    <title>Fragment scope fixture</title>
    <system>scopetest</system>
  </meta>
  <requirements>
    <req id="REQ-BIN" type="FR" title="Binary entry" priority="must" status="approved">
      <statement>The package SHALL expose a bin entry.</statement>
    </req>
    <req id="REQ-WHOLE" type="FR" title="Whole manifest" priority="must" status="approved">
      <statement>The manifest SHALL declare no model SDK.</statement>
    </req>
    <req id="REQ-CODE" type="FR" title="Code symbol" priority="must" status="approved">
      <statement>The module SHALL export run.</statement>
    </req>
  </requirements>
  <trace>
    <edge id="E-BIN" type="implements" from="pkg/package.json#bin" to="REQ-BIN"/>
    <edge id="E-WHOLE" type="implements" from="pkg/package.json" to="REQ-WHOLE"/>
    <edge id="E-CODE" type="implements" from="src/run.ts#run" to="REQ-CODE"/>
  </trace>
</rqml>`;

function doc(): RqmlDocument {
  const r = parse(DOC);
  if (!r.ok) throw new Error(`fixture failed to parse: ${r.error.message}`);
  return r.document;
}

const MANIFEST = {
  name: "demo",
  version: "1.0.0",
  bin: { rqml: "dist/cli.js" },
  scripts: { build: "tsup" },
};

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A temp project whose manifest and source both exist. */
function project(manifest: unknown = MANIFEST): string {
  const baseDir = mkdtempSync(join(tmpdir(), "rqml-scope-"));
  dirs.push(baseDir);
  mkdirSync(join(baseDir, "pkg"));
  writeManifest(baseDir, manifest);
  mkdirSync(join(baseDir, "src"));
  writeFileSync(join(baseDir, "src", "run.ts"), "export function run() {}\n");
  return baseDir;
}

function writeManifest(baseDir: string, manifest: unknown, indent = 2): void {
  writeFileSync(
    join(baseDir, "pkg", "package.json"),
    `${JSON.stringify(manifest, null, indent)}\n`,
  );
}

function statuses(baseDir: string, baseline: Record<string, string>) {
  const report = detectDrift(doc(), { baseDir, baseline });
  const byId: Record<string, string> = {};
  for (const finding of [...report.drifted, ...report.contextChanged]) {
    byId[finding.edgeId] = finding.status;
  }
  return { report, byId };
}

describe("locator fragments", () => {
  it("splits at the first #, and an empty fragment is no fragment", () => {
    expect(fragmentOf("package.json#bin")).toBe("bin");
    expect(fragmentOf("package.json")).toBeUndefined();
    expect(fragmentOf("package.json#")).toBeUndefined();
    expect(fragmentOf("a.json#x#y")).toBe("x#y");
  });

  it("reads a bare member name literally and a leading / as a JSON Pointer", () => {
    expect(parseFragmentPointer("bin")).toEqual(["bin"]);
    // A scoped package name is a member name, not a path: no escaping needed.
    expect(parseFragmentPointer("@scope/pkg")).toEqual(["@scope/pkg"]);
    expect(parseFragmentPointer("/scripts/build")).toEqual(["scripts", "build"]);
    // RFC 6901: ~1 becomes / and ~0 becomes ~, in that order.
    expect(parseFragmentPointer("/a~1b")).toEqual(["a/b"]);
    expect(parseFragmentPointer("/a~01")).toEqual(["a~1"]);
    expect(parseFragmentPointer("/")).toEqual([""]);
  });

  it("interprets .json only", () => {
    expect(fragmentMediaType("/x/package.json")).toBe("json");
    expect(fragmentMediaType("/x/PACKAGE.JSON")).toBe("json");
    // Not exactly parseable, so deliberately not interpreted.
    expect(fragmentMediaType("/x/tsconfig.jsonc")).toBeUndefined();
    expect(fragmentMediaType("/x/run.ts")).toBeUndefined();
    expect(fragmentMediaType("/x/schema.xsd")).toBeUndefined();
    expect(fragmentMediaType("/x/Makefile")).toBeUndefined();
  });
});

describe("canonical JSON", () => {
  it("is insensitive to key order and formatting, not to content", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 2 }));
  });

  it("sorts nested keys but preserves array order", () => {
    expect(canonicalJson({ z: { b: 1, a: [3, 1, 2] } })).toBe(
      '{"z":{"a":[3,1,2],"b":1}}',
    );
    expect(canonicalJson([{ b: 1, a: 2 }])).toBe('[{"a":2,"b":1}]');
  });

  it("renders primitives as JSON, so 1.0 and 1 are the same value", () => {
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson(true)).toBe("true");
    expect(canonicalJson('a"b')).toBe('"a\\"b"');
    expect(canonicalJson(JSON.parse("1.0"))).toBe(canonicalJson(1));
  });

  it("orders keys by code unit, not by locale", () => {
    // localeCompare would sort these differently on some ICU builds; the
    // recorded hash must not depend on the machine's collation.
    expect(canonicalJson({ b: 0, B: 0, a: 0, A: 0 })).toBe('{"A":0,"B":0,"a":0,"b":0}');
  });
});

describe("duplicate member detection", () => {
  it("passes ordinary documents", () => {
    expect(hasDuplicateKeys(JSON.stringify(MANIFEST))).toBe(false);
    expect(hasDuplicateKeys('{"a":{"x":1},"b":{"x":2}}')).toBe(false);
    expect(hasDuplicateKeys('[{"a":1},{"a":2}]')).toBe(false);
  });

  it("catches a member declared twice, at any depth", () => {
    expect(hasDuplicateKeys('{"a":1,"a":2}')).toBe(true);
    expect(hasDuplicateKeys('{"x":{"a":1,"a":2}}')).toBe(true);
    expect(hasDuplicateKeys('[{"a":1,"a":2}]')).toBe(true);
    // Escaped and plain spellings are the same member to a parser.
    expect(hasDuplicateKeys('{"a":1,"\\u0061":2}')).toBe(true);
  });

  it("does not mistake string values for keys", () => {
    // Array elements, and values that happen to repeat a key's text.
    expect(hasDuplicateKeys('{"a":["a","a"]}')).toBe(false);
    expect(hasDuplicateKeys('{"a":"a","b":"a"}')).toBe(false);
    // Braces, colons and escaped quotes inside string values must not confuse
    // the container stack.
    expect(hasDuplicateKeys('{"a":"{\\"b\\":1}","b":"x:y"}')).toBe(false);
    expect(hasDuplicateKeys('{"a":"}","a":1}')).toBe(true);
  });

  it("treats unreadable input as ambiguous rather than clean", () => {
    expect(hasDuplicateKeys('{"a":"unterminated')).toBe(true);
  });
});

describe("resolving a JSON fragment", () => {
  const text = JSON.stringify({
    bin: { rqml: "dist/cli.js" },
    files: ["dist", "README.md"],
    empty: null,
  });

  it("finds top-level members, pointers and array elements", () => {
    expect(resolveJsonFragment(text, "bin")).toEqual({
      ok: true,
      value: { rqml: "dist/cli.js" },
    });
    expect(resolveJsonFragment(text, "/bin/rqml")).toEqual({
      ok: true,
      value: "dist/cli.js",
    });
    expect(resolveJsonFragment(text, "/files/1")).toEqual({
      ok: true,
      value: "README.md",
    });
    expect(resolveJsonFragment(text, "empty")).toEqual({ ok: true, value: null });
  });

  it("fails, with a reason, on everything it cannot resolve exactly", () => {
    const reasons = [
      resolveJsonFragment(text, "nope"),
      resolveJsonFragment(text, "/files/9"),
      resolveJsonFragment(text, "/files/-"),
      resolveJsonFragment(text, "/files/01"),
      resolveJsonFragment(text, "/empty/x"),
      resolveJsonFragment(text, "/bin/rqml/deeper"),
      resolveJsonFragment(text, "L12-L20"),
      resolveJsonFragment("{not json", "bin"),
      resolveJsonFragment('{"bin":1,"bin":2}', "bin"),
    ];
    for (const result of reasons) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason.length).toBeGreaterThan(0);
    }
  });
});

describe("hashing a fragment on disk", () => {
  it("ignores reformatting and key order, but not the value", () => {
    const baseDir = project();
    const path = join(baseDir, "pkg", "package.json");
    const before = fragmentHashAt(path, "bin");
    expect(before.ok).toBe(true);

    writeManifest(baseDir, { ...MANIFEST, bin: { rqml: "dist/cli.js" } }, 8);
    expect(fragmentHashAt(path, "bin")).toEqual(before);

    writeManifest(baseDir, { ...MANIFEST, bin: { rqml: "dist/other.js" } });
    expect(fragmentHashAt(path, "bin")).not.toEqual(before);
  });

  it("refuses media types it does not interpret, and unreadable files", () => {
    const baseDir = project();
    expect(fragmentHashAt(join(baseDir, "src", "run.ts"), "run").ok).toBe(false);
    expect(fragmentHashAt(join(baseDir, "pkg", "absent.json"), "bin").ok).toBe(false);
  });
});

describe("baseline encoding", () => {
  const file = "a".repeat(64);
  const span = "b".repeat(64);

  it("keeps whole-file scope as the bare hash it has always been", () => {
    expect(encodeBaselineEntry({ fileHash: file })).toBe(file);
    expect(decodeBaselineEntry(file)).toEqual({ fileHash: file });
  });

  it("round-trips fragment scope through a prefixed string", () => {
    const encoded = encodeBaselineEntry({ fileHash: file, spanHash: span });
    expect(encoded).toBe(`f1:${span}:${file}`);
    expect(decodeBaselineEntry(encoded)).toEqual({ fileHash: file, spanHash: span });
  });

  it("rejects anything it does not understand, so the caller can fail closed", () => {
    for (const value of [
      "",
      "not-a-hash",
      file.slice(0, 63),
      `${file}0`,
      `f1:${span}`,
      `f1:${span}:${file}:extra`,
      `f1:zz${span.slice(2)}:${file}`,
      `f2:${span}:${file}`, // a scheme from a newer version
      JSON.stringify({ fileHash: file }),
    ]) {
      expect(decodeBaselineEntry(value)).toBeUndefined();
    }
  });
});

describe("drift with fragment scope (REQ-CORE-DRIFT-SCOPE)", () => {
  it("records a fragment hash only for locators that name one in JSON", () => {
    const baseline = computeBaseline(doc(), { baseDir: project() });
    expect(decodeBaselineEntry(baseline["E-BIN"] as string)?.spanHash).toBeDefined();
    // No fragment, and a fragment in a media type that is not interpreted.
    expect(decodeBaselineEntry(baseline["E-WHOLE"] as string)?.spanHash).toBeUndefined();
    expect(decodeBaselineEntry(baseline["E-CODE"] as string)?.spanHash).toBeUndefined();
  });

  it("passes cleanly when nothing changed", () => {
    const baseDir = project();
    const report = detectDrift(doc(), {
      baseDir,
      baseline: computeBaseline(doc(), { baseDir }),
    });
    expect(report.drifted).toEqual([]);
    expect(report.contextChanged).toEqual([]);
    expect(report.diagnostics).toEqual([]);
  });

  it("downgrades a change outside the fragment to context, and does not block", () => {
    const baseDir = project();
    const baseline = computeBaseline(doc(), { baseDir });
    writeManifest(baseDir, { ...MANIFEST, version: "1.0.1" });

    const { report, byId } = statuses(baseDir, baseline);
    expect(byId["E-BIN"]).toBe("context-changed");
    // The whole-file edge on the same file is still hard drift: only the
    // locator that declared a fragment is narrowed.
    expect(byId["E-WHOLE"]).toBe("changed");
    expect(report.contextChanged.map((f) => f.edgeId)).toEqual(["E-BIN"]);
    expect(report.drifted.map((f) => f.edgeId)).toEqual(["E-WHOLE"]);

    const advisory = report.diagnostics.find(
      (d) => d.rule === "context-changed-implementation",
    );
    expect(advisory?.severity).toBe("warning");
    expect(advisory?.message).toContain("rqml link --refresh E-BIN");
  });

  it("treats reformatting the file as context, not drift", () => {
    const baseDir = project();
    const baseline = computeBaseline(doc(), { baseDir });
    writeManifest(baseDir, MANIFEST, 4);
    expect(statuses(baseDir, baseline).byId["E-BIN"]).toBe("context-changed");
  });

  it("still reports drift when the fragment itself changes", () => {
    const baseDir = project();
    const baseline = computeBaseline(doc(), { baseDir });
    writeManifest(baseDir, { ...MANIFEST, bin: { rqml: "dist/renamed.js" } });
    expect(statuses(baseDir, baseline).byId["E-BIN"]).toBe("changed");
  });

  it("reports drift when the fragment is deleted, never a pass", () => {
    const baseDir = project();
    const baseline = computeBaseline(doc(), { baseDir });
    const { bin: _dropped, ...withoutBin } = MANIFEST;
    writeManifest(baseDir, withoutBin);
    expect(statuses(baseDir, baseline).byId["E-BIN"]).toBe("changed");
  });

  it("reports drift when the file stops being parseable JSON", () => {
    const baseDir = project();
    const baseline = computeBaseline(doc(), { baseDir });
    writeFileSync(join(baseDir, "pkg", "package.json"), "{ not json\n");
    expect(statuses(baseDir, baseline).byId["E-BIN"]).toBe("changed");
  });

  it("reports drift when the file becomes ambiguous about the fragment", () => {
    const baseDir = project();
    const baseline = computeBaseline(doc(), { baseDir });
    // Same `bin` value, declared twice: a parser would keep one, so the file no
    // longer uniquely supports the reading the baseline recorded.
    writeFileSync(
      join(baseDir, "pkg", "package.json"),
      '{"name":"demo","bin":{"rqml":"dist/cli.js"},"bin":{"rqml":"dist/cli.js"}}\n',
    );
    expect(statuses(baseDir, baseline).byId["E-BIN"]).toBe("changed");
  });

  it("cannot narrow against a legacy whole-file baseline", () => {
    const baseDir = project();
    // What every baseline in the wild looks like today: a bare sha256.
    const legacy = { "E-BIN": computeBaselineFileHash(baseDir) };
    writeManifest(baseDir, { ...MANIFEST, version: "1.0.1" });
    const { byId } = statuses(baseDir, legacy);
    expect(byId["E-BIN"]).toBe("changed");
  });

  it("fails closed on a baseline value it cannot read", () => {
    const baseDir = project();
    for (const value of ["f2:deadbeef:cafe", "garbage"]) {
      const { byId } = statuses(baseDir, { "E-BIN": value });
      expect(byId["E-BIN"]).toBe("changed");
    }
  });

  it("fails closed when a recorded artifact exists but cannot be hashed", () => {
    const baseDir = project();
    const baseline = computeBaseline(doc(), { baseDir });
    // A file replaced by a directory still "exists"; it can no longer be read.
    rmSync(join(baseDir, "pkg", "package.json"));
    mkdirSync(join(baseDir, "pkg", "package.json"));
    const { byId } = statuses(baseDir, baseline);
    expect(byId["E-BIN"]).toBe("changed");
    expect(byId["E-WHOLE"]).toBe("changed");
  });

  it("still reports a missing artifact as missing", () => {
    const baseDir = project();
    const baseline = computeBaseline(doc(), { baseDir });
    rmSync(join(baseDir, "pkg", "package.json"));
    expect(statuses(baseDir, baseline).byId["E-BIN"]).toBe("missing");
  });

  it("never narrows a locator with no fragment, whatever the media type", () => {
    // The protection that keeps a prohibition like REQ-CORE-NO-LLM honest: its
    // evidence is the whole manifest, so scripts and every dependency channel
    // stay in scope by construction.
    const baseDir = project();
    const baseline = computeBaseline(doc(), { baseDir });
    writeManifest(baseDir, { ...MANIFEST, dependencies: { "some-llm-sdk": "^1" } });
    expect(statuses(baseDir, baseline).byId["E-WHOLE"]).toBe("changed");
  });

  it("never narrows a media type it does not interpret", () => {
    const baseDir = project();
    const baseline = computeBaseline(doc(), { baseDir });
    writeFileSync(
      join(baseDir, "src", "run.ts"),
      "// a comment\nexport function run() {}\n",
    );
    expect(statuses(baseDir, baseline).byId["E-CODE"]).toBe("changed");
  });
});

/** The bare sha256 an older @rqml/core would have written for package.json. */
function computeBaselineFileHash(baseDir: string): string {
  const noFragment = parse(DOC);
  if (!noFragment.ok) throw new Error("fixture failed to parse");
  const baseline = computeBaseline(noFragment.document, { baseDir });
  const whole = baseline["E-WHOLE"];
  if (whole === undefined) throw new Error("no whole-file entry");
  return whole;
}
