import { describe, expect, it } from "vitest";
import { EXIT, UsageError, parseArgs } from "../src/runtime.js";

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
});
