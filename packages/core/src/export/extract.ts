import type { Criterion, Locator, RqmlDocument, TraceType } from "../model/types.js";
import { declaredIdIndex, requirementIndex } from "../trace/index.js";

/** One trace edge touching the extracted artifact, with its far endpoint. */
export interface SliceEdge {
  edgeId: string;
  type: TraceType;
  direction: "outgoing" | "incoming";
  /** Local id or doc/external URI at the far end. */
  target: string;
  /** Element kind for local targets, else the locator kind. */
  targetKind: string;
  title?: string;
}

/**
 * A single artifact extracted with everything an agent needs to work on it,
 * and nothing else (REQ-LOOP-SHOW): identity, normative content, acceptance
 * criteria, and the trace neighborhood.
 */
export interface ArtifactSlice {
  id: string;
  kind: string;
  title?: string;
  /** Statement, narrative, definition, or description — whatever the kind carries. */
  statement?: string;
  reqType?: string;
  status?: string;
  priority?: string;
  rationale?: string;
  notes?: string;
  acceptance?: Criterion[];
  edges: SliceEdge[];
}

function endpointKey(locator: Locator): string {
  return locator.kind === "local" ? locator.id : locator.uri;
}

/** Best-effort title/statement lookup for non-requirement kinds. */
function details(doc: RqmlDocument, id: string, kind: string): Partial<ArtifactSlice> {
  switch (kind) {
    case "goal": {
      const g = doc.goals?.goals?.find((x) => x.id === id);
      return g
        ? {
            title: g.title,
            statement: g.statement,
            status: g.status,
            priority: g.priority,
            rationale: g.rationale,
          }
        : {};
    }
    case "qgoal": {
      const g = doc.goals?.qualityGoals?.find((x) => x.id === id);
      return g
        ? {
            title: g.title,
            statement: g.statement,
            status: g.status,
            priority: g.priority,
            notes: g.metric,
          }
        : {};
    }
    case "obstacle": {
      const o = doc.goals?.obstacles?.find((x) => x.id === id);
      return o ? { title: o.title, statement: o.statement, notes: o.mitigation } : {};
    }
    case "scenario":
    case "misuseCase":
    case "edgeCase": {
      const all = [
        ...(doc.scenarios?.scenarios ?? []),
        ...(doc.scenarios?.misuseCases ?? []),
        ...(doc.scenarios?.edgeCases ?? []),
      ];
      const s = all.find((x) => x.id === id);
      return s ? { title: s.title, statement: s.narrative } : {};
    }
    case "testCase": {
      const t = doc.verification?.testCases?.find((x) => x.id === id);
      return t ? { title: t.title, statement: t.purpose, notes: t.expected } : {};
    }
    case "testSuite": {
      const t = doc.verification?.testSuites?.find((x) => x.id === id);
      return t ? { title: t.title, statement: t.description } : {};
    }
    case "risk": {
      const r = doc.catalogs?.risks?.find((x) => x.id === id);
      return r ? { statement: r.statement, notes: r.mitigation } : {};
    }
    case "constraint": {
      const c = doc.catalogs?.constraints?.find((x) => x.id === id);
      return c ? { statement: c.statement } : {};
    }
    case "decision": {
      const d = doc.catalogs?.decisions?.find((x) => x.id === id);
      return d ? { statement: d.decision, rationale: d.context, status: d.status } : {};
    }
    case "term": {
      const t = doc.catalogs?.glossary?.find((x) => x.id === id);
      return t ? { title: t.name, statement: t.definition } : {};
    }
    case "rule": {
      const r = doc.domain?.businessRules?.find((x) => x.id === id);
      return r ? { statement: r.statement, notes: r.examples } : {};
    }
    case "entity": {
      const e = doc.domain?.entities?.find((x) => x.id === id);
      return e ? { title: e.name, statement: e.description } : {};
    }
    case "stateMachine": {
      const sm = doc.behavior?.stateMachines?.find((x) => x.id === id);
      return sm ? { title: sm.name, statement: sm.description } : {};
    }
    default:
      return {};
  }
}

/**
 * Extract one artifact by id with its trace neighborhood, or `undefined` when
 * the id is not declared in the document. Pure and deterministic; edges appear
 * in document order.
 */
export function extractArtifact(
  doc: RqmlDocument,
  id: string,
): ArtifactSlice | undefined {
  const idIndex = declaredIdIndex(doc);
  const ref = idIndex.get(id);
  if (ref === undefined) return undefined;

  const slice: ArtifactSlice = { id, kind: ref.kind, edges: [] };

  const req = requirementIndex(doc).get(id);
  if (req !== undefined) {
    slice.title = req.title;
    slice.statement = req.statement;
    slice.reqType = req.type;
    if (req.status !== undefined) slice.status = req.status;
    if (req.priority !== undefined) slice.priority = req.priority;
    if (req.rationale !== undefined) slice.rationale = req.rationale;
    if (req.notes !== undefined) slice.notes = req.notes;
    if (req.acceptance.length > 0) slice.acceptance = req.acceptance;
  } else {
    const extra = Object.fromEntries(
      Object.entries(details(doc, id, ref.kind)).filter(([, v]) => v !== undefined),
    );
    Object.assign(slice, extra);
  }

  for (const edge of doc.trace) {
    const fromKey = endpointKey(edge.from);
    const toKey = endpointKey(edge.to);
    if (fromKey !== id && toKey !== id) continue;
    const direction: SliceEdge["direction"] = fromKey === id ? "outgoing" : "incoming";
    const far = direction === "outgoing" ? edge.to : edge.from;
    const target = endpointKey(far);
    const targetKind =
      far.kind === "local" ? (idIndex.get(target)?.kind ?? "unknown") : far.kind;
    const sliceEdge: SliceEdge = {
      edgeId: edge.id,
      type: edge.type,
      direction,
      target,
      targetKind,
    };
    if (far.kind !== "local" && far.title !== undefined) sliceEdge.title = far.title;
    slice.edges.push(sliceEdge);
  }

  return slice;
}

/** Render a slice as compact markdown for human or agent consumption. */
export function sliceToMarkdown(slice: ArtifactSlice): string {
  const lines: string[] = [];
  const heading = slice.title !== undefined ? `${slice.id} — ${slice.title}` : slice.id;
  lines.push(`## ${heading}`);

  const facts: string[] = [
    `kind: ${slice.kind}${slice.reqType !== undefined ? ` (${slice.reqType})` : ""}`,
  ];
  if (slice.status !== undefined) facts.push(`status: ${slice.status}`);
  if (slice.priority !== undefined) facts.push(`priority: ${slice.priority}`);
  lines.push(facts.join(" · "), "");

  if (slice.statement !== undefined) lines.push(slice.statement.trim(), "");
  if (slice.rationale !== undefined) {
    lines.push(`**Rationale:** ${slice.rationale.trim()}`, "");
  }
  if (slice.notes !== undefined) lines.push(`**Notes:** ${slice.notes.trim()}`, "");

  if (slice.acceptance !== undefined && slice.acceptance.length > 0) {
    lines.push("### Acceptance");
    for (const c of slice.acceptance) {
      const parts: string[] = [];
      if (c.given !== undefined) parts.push(`GIVEN ${c.given.trim()}`);
      if (c.when !== undefined) parts.push(`WHEN ${c.when.trim()}`);
      parts.push(`THEN ${c.then.trim()}`);
      lines.push(`- ${c.id !== undefined ? `\`${c.id}\` ` : ""}${parts.join(" ")}`);
    }
    lines.push("");
  }

  if (slice.edges.length > 0) {
    lines.push("### Trace");
    for (const e of slice.edges) {
      const arrow = e.direction === "outgoing" ? "→" : "←";
      lines.push(`- ${arrow} ${e.type} ${e.target} (${e.targetKind}, \`${e.edgeId}\`)`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}
