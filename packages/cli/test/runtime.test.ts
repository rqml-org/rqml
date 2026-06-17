import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  EXIT,
  UsageError,
  flagString,
  parseArgs,
  resolveSpecPath,
  specArgs,
} from "../src/runtime.js";

describe("parseArgs", () => {
  it("defaults strictness to standard and json to false", () => {
    const a = parseArgs(["spec.rqml"]);
    expect(a.positionals).toEqual(["spec.rqml"]);
    expect(a.strictness).toBe("standard");
    expect(a.json).toBe(false);
  });

  it("reads --json and --strictness in both forms", () => {
    expect(parseArgs(["--json"]).json).toBe(true);
    expect(parseArgs(["--strictness", "strict"]).strictness).toBe("strict");
    expect(parseArgs(["--strictness=certified"]).strictness).toBe("certified");
  });

  it("rejects an unknown strictness level", () => {
    expect(() => parseArgs(["--strictness", "bogus"])).toThrow(UsageError);
  });

  it("documents stable exit codes", () => {
    expect(EXIT).toEqual({ OK: 0, VALIDATION: 1, CHECK: 2, USAGE: 64 });
  });

  it("exposes command-specific flags", () => {
    const a = parseArgs(["REQ-1", "src/a.ts", "--type", "verifiedBy", "--id=E-X"]);
    expect(a.positionals).toEqual(["REQ-1", "src/a.ts"]);
    expect(flagString(a, "type")).toBe("verifiedBy");
    expect(flagString(a, "id")).toBe("E-X");
    expect(flagString(a, "missing")).toBeUndefined();
  });

  it("specArgs prefers --spec over positionals", () => {
    const a = parseArgs(["REQ-1", "--spec", "other.rqml"]);
    expect(specArgs(a).positionals).toEqual(["other.rqml"]);
    expect(specArgs(parseArgs(["REQ-1"])).positionals).toEqual([]);
  });
});

describe("resolveSpecPath", () => {
  let dir: string;
  const args = (baseDir: string, positionals: string[] = []) => ({
    positionals,
    json: false,
    strictness: "standard" as const,
    baseDir,
    flags: new Map<string, string | boolean>(),
  });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rqml-cli-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("ignores a `.rqml` directory and auto-detects the .rqml file (EISDIR regression)", () => {
    // A `.rqml/` governance directory sorts first and ends with ".rqml" — it must
    // not be mistaken for the spec, which previously caused `EISDIR ... read`.
    mkdirSync(join(dir, ".rqml"));
    writeFileSync(join(dir, "project.rqml"), "<rqml/>");
    expect(resolveSpecPath(args(dir))).toBe(join(dir, "project.rqml"));
  });

  it("prefers requirements.rqml when present", () => {
    writeFileSync(join(dir, "other.rqml"), "<rqml/>");
    writeFileSync(join(dir, "requirements.rqml"), "<rqml/>");
    expect(resolveSpecPath(args(dir))).toBe(join(dir, "requirements.rqml"));
  });

  it("rejects an explicit directory path with a clear message (not EISDIR)", () => {
    mkdirSync(join(dir, ".rqml"));
    expect(() => resolveSpecPath(args(dir, [".rqml"]))).toThrow(UsageError);
  });

  it("errors when no .rqml file exists", () => {
    mkdirSync(join(dir, ".rqml")); // a dir, but no actual spec file
    expect(() => resolveSpecPath(args(dir))).toThrow(UsageError);
  });

  it("walks up to the governing spec in a parent directory (nearest-wins)", () => {
    mkdirSync(join(dir, ".git"));
    writeFileSync(join(dir, "requirements.rqml"), "<rqml/>");
    mkdirSync(join(dir, "packages", "api"), { recursive: true });
    expect(resolveSpecPath(args(join(dir, "packages", "api")))).toBe(
      join(dir, "requirements.rqml"),
    );
  });

  it("reports an ambiguous directory rather than guessing a spec", () => {
    writeFileSync(join(dir, "a.rqml"), "<rqml/>");
    writeFileSync(join(dir, "b.rqml"), "<rqml/>");
    expect(() => resolveSpecPath(args(dir))).toThrow(UsageError);
  });
});
