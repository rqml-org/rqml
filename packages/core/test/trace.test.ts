import { describe, expect, it } from "vitest";
import { declaredIdIndex, resolveTrace } from "../src/trace/index.js";
import type { RqmlDocument, TraceEdge } from "../src/model/types.js";

function edge(id: string, fromId: string, toId: string): TraceEdge {
  return {
    id,
    type: "satisfies",
    from: { kind: "local", id: fromId },
    to: { kind: "local", id: toId },
  };
}

function doc(trace: TraceEdge[]): RqmlDocument {
  return {
    version: "2.1.0",
    docId: "D",
    status: "draft",
    meta: { title: "t", system: "s", authors: [] },
    packages: [],
    looseRequirements: [
      { id: "R1", type: "FR", title: "R1", statement: "x", acceptance: [] },
      { id: "R2", type: "FR", title: "R2", statement: "x", acceptance: [] },
    ],
    trace,
  };
}

describe("resolveTrace", () => {
  it("resolves local endpoints to their requirements", () => {
    const { edges, diagnostics } = resolveTrace(doc([edge("E1", "R1", "R2")]));
    expect(diagnostics).toEqual([]);
    expect(edges[0]?.from.requirement?.id).toBe("R1");
    expect(edges[0]?.to.requirement?.id).toBe("R2");
  });

  it("reports a diagnostic for a dangling local reference", () => {
    const { diagnostics } = resolveTrace(doc([edge("E1", "R1", "R-NOPE")]));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.source).toBe("trace");
    expect(diagnostics[0]?.rule).toBe("unresolved-local-ref");
    expect(diagnostics[0]?.message).toContain("R-NOPE");
  });
});

const crossSection: RqmlDocument = {
  version: "2.1.0",
  docId: "D",
  status: "draft",
  meta: { title: "t", system: "s", authors: [] },
  goals: { goals: [{ id: "G1", title: "Goal", statement: "x" }] },
  catalogs: { risks: [{ id: "RISK1", statement: "danger" }] },
  packages: [],
  looseRequirements: [
    { id: "R1", type: "FR", title: "R1", statement: "x", acceptance: [] },
  ],
  trace: [
    edge("E1", "R1", "G1"),
    { ...edge("E2", "R1", "RISK1"), type: "mitigates" },
    edge("E3", "R1", "GHOST"),
  ],
};

describe("resolveTrace across sections", () => {
  it("resolves edges to non-requirement targets with the right kind", () => {
    const { edges } = resolveTrace(crossSection);
    expect(edges[0]?.to.target?.kind).toBe("goal");
    expect(edges[0]?.to.requirement).toBeUndefined();
    expect(edges[1]?.to.target?.kind).toBe("risk");
    // Requirement sources still populate `requirement` for back-compat.
    expect(edges[0]?.from.target?.kind).toBe("req");
    expect(edges[0]?.from.requirement?.id).toBe("R1");
  });

  it("still flags a dangling ref even when other sections exist", () => {
    const { diagnostics } = resolveTrace(crossSection);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain("GHOST");
  });

  it("indexes every declared id with its kind", () => {
    const idx = declaredIdIndex(crossSection);
    expect(idx.get("R1")?.kind).toBe("req");
    expect(idx.get("G1")?.kind).toBe("goal");
    expect(idx.get("RISK1")?.kind).toBe("risk");
    expect(idx.has("GHOST")).toBe(false);
  });
});
