import type { Diagnostic } from "../model/diagnostic.js";
import {
  type ElementRef,
  type RqmlDocument,
  type TraceType,
  allRequirements,
} from "../model/types.js";
import { declaredIdIndex, resolveTrace } from "../trace/index.js";

/** Trace edges grouped around a single artifact, split by direction and type. */
export interface ArtifactCoverage {
  id: string;
  /** Ids of edges leaving this artifact, grouped by trace type (each sorted). */
  outgoing: Partial<Record<TraceType, string[]>>;
  /** Ids of edges arriving at this artifact, grouped by trace type (each sorted). */
  incoming: Partial<Record<TraceType, string[]>>;
}

/** An implements edge whose requirement endpoint is not approved. */
export interface PrematureImplementation {
  edgeId: string;
  requirementId: string;
}

/**
 * Deterministic coverage of an RQML document over its trace graph
 * (REQ-CORE-COVERAGE). Every output array is sorted, so repeated runs on the
 * same document yield identical results (QGOAL-DETERMINISTIC).
 */
export interface CoverageReport {
  /** Per-requirement incoming/outgoing edges, sorted by requirement id. */
  requirements: ArtifactCoverage[];
  /** Goal/quality-goal ids with no incoming `satisfies` edge. */
  uncoveredGoals: string[];
  /** Requirement ids with no `verifiedBy` (out) or `covers` (in) edge. */
  unverifiedRequirements: string[];
  /** Requirement ids with no incoming `implements` edge from a code artifact. */
  unimplementedRequirements: string[];
  /**
   * Approved requirement ids with no incoming `implements` edge — the
   * lifecycle-aware implementation gap, since only approved artifacts should
   * drive implementation (REQ-CORE-STATUS-AWARE).
   */
  unimplementedApprovedRequirements: string[];
  /** Implements edges targeting a requirement that is not approved. */
  prematureImplementations: PrematureImplementation[];
  /** Requirement ids that satisfy no goal or scenario (trace up to nothing). */
  orphanRequirements: string[];
  /** Coverage findings plus dangling local-reference diagnostics from trace. */
  diagnostics: Diagnostic[];
}

const UPWARD_TARGET_KINDS = new Set([
  "goal",
  "qgoal",
  "scenario",
  "misuseCase",
  "edgeCase",
]);

function add(
  group: Partial<Record<TraceType, string[]>>,
  type: TraceType,
  edgeId: string,
) {
  const existing = group[type];
  if (existing) {
    existing.push(edgeId);
  } else {
    group[type] = [edgeId];
  }
}

function sortGroups(group: Partial<Record<TraceType, string[]>>) {
  for (const key of Object.keys(group) as TraceType[]) {
    group[key] = [...new Set(group[key])].sort();
  }
}

/** Compute coverage for a parsed document. Pure and deterministic. */
export function computeCoverage(doc: RqmlDocument): CoverageReport {
  const idIndex = declaredIdIndex(doc);
  const reqs = allRequirements(doc);
  const reqIds = new Set(reqs.map((r) => r.id));

  const outgoing = new Map<string, Partial<Record<TraceType, string[]>>>();
  const incoming = new Map<string, Partial<Record<TraceType, string[]>>>();
  const ensure = (m: Map<string, Partial<Record<TraceType, string[]>>>, id: string) => {
    let g = m.get(id);
    if (g === undefined) {
      g = {};
      m.set(id, g);
    }
    return g;
  };

  for (const edge of doc.trace) {
    if (edge.from.kind === "local")
      add(ensure(outgoing, edge.from.id), edge.type, edge.id);
    if (edge.to.kind === "local") add(ensure(incoming, edge.to.id), edge.type, edge.id);
  }

  const requirements: ArtifactCoverage[] = [...reqIds].sort().map((id) => {
    const out = outgoing.get(id) ?? {};
    const inc = incoming.get(id) ?? {};
    sortGroups(out);
    sortGroups(inc);
    return { id, outgoing: out, incoming: inc };
  });

  // Goals/qgoals with no incoming `satisfies` edge.
  const uncoveredGoals: string[] = [];
  for (const [id, ref] of idIndex) {
    if (ref.kind !== "goal" && ref.kind !== "qgoal") continue;
    if (!(incoming.get(id)?.satisfies?.length ?? 0)) uncoveredGoals.push(id);
  }
  uncoveredGoals.sort();

  const statusOf = new Map(reqs.map((r) => [r.id, r.status]));

  const unverifiedRequirements: string[] = [];
  const unimplementedRequirements: string[] = [];
  const unimplementedApprovedRequirements: string[] = [];
  const orphanRequirements: string[] = [];
  for (const id of [...reqIds].sort()) {
    const out = outgoing.get(id) ?? {};
    const inc = incoming.get(id) ?? {};
    const verified = (out.verifiedBy?.length ?? 0) > 0 || (inc.covers?.length ?? 0) > 0;
    if (!verified) unverifiedRequirements.push(id);
    if (!(inc.implements?.length ?? 0)) {
      unimplementedRequirements.push(id);
      if (statusOf.get(id) === "approved") unimplementedApprovedRequirements.push(id);
    }

    const satisfiesUpward = (out.satisfies ?? []).some((edgeId) => {
      const edge = doc.trace.find((e) => e.id === edgeId);
      const to = edge?.to;
      if (to?.kind !== "local") return false;
      const target: ElementRef | undefined = idIndex.get(to.id);
      return target !== undefined && UPWARD_TARGET_KINDS.has(target.kind);
    });
    if (!satisfiesUpward) orphanRequirements.push(id);
  }

  // Implements edges pointing at a requirement that is not approved
  // (REQ-CORE-STATUS-AWARE): implementation preceded approval.
  const prematureImplementations: PrematureImplementation[] = [];
  for (const edge of doc.trace) {
    if (edge.type !== "implements" || edge.to.kind !== "local") continue;
    const requirementId = edge.to.id;
    if (!reqIds.has(requirementId)) continue;
    if (statusOf.get(requirementId) === "approved") continue;
    prematureImplementations.push({ edgeId: edge.id, requirementId });
  }
  prematureImplementations.sort((a, b) => a.edgeId.localeCompare(b.edgeId));

  const diagnostics: Diagnostic[] = [];
  for (const id of uncoveredGoals)
    diagnostics.push(
      finding(
        "coverage",
        "uncovered-goal",
        `Goal "${id}" has no satisfying requirement.`,
      ),
    );
  for (const id of unverifiedRequirements)
    diagnostics.push(
      finding(
        "coverage",
        "unverified-requirement",
        `Requirement "${id}" has no verification edge.`,
      ),
    );
  for (const id of unimplementedRequirements)
    diagnostics.push(
      finding(
        "coverage",
        "unimplemented-requirement",
        `Requirement "${id}" has no implementation link.`,
      ),
    );
  for (const id of orphanRequirements)
    diagnostics.push(
      finding(
        "coverage",
        "orphan-requirement",
        `Requirement "${id}" satisfies no goal or scenario.`,
      ),
    );
  for (const p of prematureImplementations)
    diagnostics.push(
      finding(
        "coverage",
        "premature-implementation",
        `implements edge "${p.edgeId}" targets requirement "${p.requirementId}", which is not approved.`,
      ),
    );
  // Fold in dangling local-reference diagnostics (REQ-CORE-COVERAGE).
  diagnostics.push(...resolveTrace(doc).diagnostics);

  return {
    requirements,
    uncoveredGoals,
    unverifiedRequirements,
    unimplementedRequirements,
    unimplementedApprovedRequirements,
    prematureImplementations,
    orphanRequirements,
    diagnostics,
  };
}

function finding(
  source: Diagnostic["source"],
  rule: string,
  message: string,
): Diagnostic {
  return { source, severity: "warning", rule, message };
}
