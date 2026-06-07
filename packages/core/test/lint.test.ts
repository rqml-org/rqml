import { describe, expect, it } from "vitest";
import { lint } from "../src/lint/index.js";
import type { Requirement, RqmlDocument } from "../src/model/types.js";

function req(id: string, acceptance: Requirement["acceptance"]): Requirement {
  return { id, type: "FR", title: id, statement: "x", acceptance };
}

function doc(requirements: Requirement[]): RqmlDocument {
  return {
    version: "2.1.0",
    docId: "D",
    status: "draft",
    meta: { title: "t", system: "s", authors: [] },
    packages: [],
    looseRequirements: requirements,
    trace: [],
  };
}

const withGap = doc([
  req("R1", [{ then: "ok" }]),
  req("R2", []),
]);

describe("lint missing-acceptance", () => {
  it("warns by default for requirements lacking acceptance criteria", () => {
    const diags = lint(withGap);
    expect(diags).toHaveLength(1);
    expect(diags[0]?.rule).toBe("missing-acceptance");
    expect(diags[0]?.severity).toBe("warning");
    expect(diags[0]?.message).toContain("R2");
  });

  it("escalates to error under strict", () => {
    const diags = lint(withGap, { strictness: "strict" });
    expect(diags[0]?.severity).toBe("error");
  });

  it("downgrades to info under lenient", () => {
    const diags = lint(withGap, { strictness: "lenient" });
    expect(diags).toHaveLength(1);
    expect(diags[0]?.severity).toBe("info");
  });
});
