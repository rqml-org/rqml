import type { Diagnostic } from "../model/diagnostic.js";
import {
  allRequirements,
  declaredElements,
  type ElementRef,
  type Locator,
  type Requirement,
  type RqmlDocument,
  type TraceEdge,
} from "../model/types.js";

/** A trace endpoint resolved against the document's declared elements. */
export interface ResolvedEndpoint {
  locator: Locator;
  /** The element a local locator points at, across any section, when one exists. */
  target?: ElementRef;
  /**
   * The requirement a local locator points at, when the target is a
   * requirement. Retained for back-compat with requirement-centric callers;
   * `target` is the general field.
   */
  requirement?: Requirement;
}

export interface ResolvedEdge {
  edge: TraceEdge;
  from: ResolvedEndpoint;
  to: ResolvedEndpoint;
}

export interface TraceResolution {
  edges: ResolvedEdge[];
  /**
   * One diagnostic per local endpoint whose id matches no declared element in
   * the document. Non-local endpoints (doc/external) are left to the caller.
   */
  diagnostics: Diagnostic[];
}

/** Index every requirement in the document by its id. */
export function requirementIndex(doc: RqmlDocument): Map<string, Requirement> {
  const index = new Map<string, Requirement>();
  for (const req of allRequirements(doc)) index.set(req.id, req);
  return index;
}

/**
 * Index every id-bearing element across the whole document by its id. First
 * declaration wins (ids are expected unique; integrity checking flags dupes).
 */
export function declaredIdIndex(doc: RqmlDocument): Map<string, ElementRef> {
  const index = new Map<string, ElementRef>();
  for (const ref of declaredElements(doc)) {
    if (!index.has(ref.id)) index.set(ref.id, ref);
  }
  return index;
}

/**
 * Resolve trace edges to the elements they reference.
 *
 * Only `local` locators are resolved here, against every declared element in
 * the document (requirements, goals, risks, states, …). A local endpoint
 * pointing at an unknown id yields a `trace` diagnostic so callers can surface
 * dangling links. When the resolved target is a requirement, `requirement` is
 * populated alongside `target` for back-compat.
 */
export function resolveTrace(doc: RqmlDocument): TraceResolution {
  const idIndex = declaredIdIndex(doc);
  const reqIndex = requirementIndex(doc);
  const diagnostics: Diagnostic[] = [];

  const resolveEndpoint = (
    locator: Locator,
    edge: TraceEdge,
    side: "from" | "to",
  ): ResolvedEndpoint => {
    if (locator.kind !== "local") return { locator };
    const target = idIndex.get(locator.id);
    if (target === undefined) {
      diagnostics.push({
        source: "trace",
        severity: "error",
        rule: "unresolved-local-ref",
        message: `Trace edge "${edge.id}" (${side}) references unknown local id "${locator.id}".`,
      });
      return { locator };
    }
    const resolved: ResolvedEndpoint = { locator, target };
    const requirement = reqIndex.get(locator.id);
    if (requirement !== undefined) resolved.requirement = requirement;
    return resolved;
  };

  const edges = doc.trace.map((edge) => ({
    edge,
    from: resolveEndpoint(edge.from, edge, "from"),
    to: resolveEndpoint(edge.to, edge, "to"),
  }));

  return { edges, diagnostics };
}
