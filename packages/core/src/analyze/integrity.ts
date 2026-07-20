import { XMLParser } from "fast-xml-parser";
import type { Diagnostic } from "../model/diagnostic.js";
import { parseEndpointRef } from "../trace/endpoint.js";

/**
 * Referential-integrity checks: unique ids across the document, and trace
 * endpoints that resolve to a declared id.
 *
 * These mirror the canonical schema's `xs:key allIds` and `xs:keyref`
 * constraints, but are implemented in code because libxml2 does not enforce
 * those constraints against the bundled XSD: the schema has a target namespace
 * with `elementFormDefault="qualified"`, yet the identity-constraint selectors
 * use unprefixed names (`.//req`, `.//edge/from/locator/local`). Per XPath 1.0
 * an unprefixed name matches the null namespace, so the selectors match nothing
 * and the constraints silently never fire. This check covers every element id
 * (goals, catalogs, behavior, ...), not just requirements, so a trace edge that
 * points at a valid goal is not falsely reported as dangling.
 */

const ATTR_PREFIX = "@_";

/**
 * Locator elements whose `id` attribute references another element instead of
 * declaring a new one. Their ids must not enter the declared-id index.
 */
const REFERENCE_ELEMENTS = new Set(["local", "doc"]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: ATTR_PREFIX,
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
});

type Node = Record<string, unknown>;

interface TraceRef {
  refId: string;
  edgeId: string;
  side: "from" | "to";
  /** Which serialization carried the reference (drives the line-lookup regex). */
  form: "nested" | "flat" | "compact";
}

/** A compact endpoint whose value is a malformed rqml: doc locator. */
interface DocRefError {
  edgeId: string;
  side: "from" | "to";
  value: string;
  error: string;
}

function isNode(v: unknown): v is Node {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function str(v: unknown): string | undefined {
  return v == null ? undefined : String(v);
}

function attr(node: Node, name: string): string | undefined {
  return str(node[ATTR_PREFIX + name]);
}

/** Trace refs from a nested 2.1.0 `<edge><from><locator><local id/>`. */
function nestedRefs(edge: Node, out: TraceRef[]): void {
  const edgeId = attr(edge, "id") ?? "";
  for (const side of ["from", "to"] as const) {
    const endpoint = edge[side];
    const locator = isNode(endpoint) ? endpoint.locator : undefined;
    const local = isNode(locator) ? locator.local : undefined;
    const refId = isNode(local) ? attr(local, "id") : undefined;
    if (refId !== undefined) out.push({ refId, edgeId, side, form: "nested" });
  }
}

/** Would parseLocator succeed on this nested endpoint child? */
function hasNestedLocator(endpoint: unknown): boolean {
  if (!isNode(endpoint)) return false;
  const locator = endpoint.locator;
  if (!isNode(locator)) return false;
  return isNode(locator.local) || isNode(locator.doc) || isNode(locator.external);
}

/** An edge element the parser drops entirely — must be reported, never silent. */
interface MalformedEdge {
  edgeId: string;
  reason: string;
}

/**
 * Trace refs from one `<edge>` element, mirroring parseTrace's PER-EDGE form
 * decision exactly (REQ-CORE-COMPACT-PARITY): nested endpoints carry the edge
 * only when BOTH are complete (parseEdge succeeds); otherwise the compact
 * from/to attributes do (RFC-0003). An edge that neither form can parse is
 * reported as malformed — a malformed rqml: value via the invalid-doc-locator
 * rule, everything else via malformed-trace-edge — so an edge the parser
 * drops can never silently escape enforcement.
 */
function edgeRefs(
  edge: Node,
  out: TraceRef[],
  docErrors: DocRefError[],
  malformed: MalformedEdge[],
): void {
  const edgeId = attr(edge, "id") ?? "";
  if (hasNestedLocator(edge.from) && hasNestedLocator(edge.to)) {
    nestedRefs(edge, out);
    return;
  }
  const fromRaw = attr(edge, "from");
  const toRaw = attr(edge, "to");
  if (fromRaw === undefined || toRaw === undefined) {
    malformed.push({
      edgeId,
      reason:
        "edge has neither two complete nested endpoints nor both from and to attributes",
    });
    return;
  }
  const locals: TraceRef[] = [];
  let broken = false;
  for (const side of ["from", "to"] as const) {
    const value = side === "from" ? fromRaw : toRaw;
    const result = parseEndpointRef(value);
    if (!result.ok) {
      broken = true;
      if (/^rqml:/i.test(value.trim())) {
        docErrors.push({ edgeId, side, value, error: result.error });
      } else {
        malformed.push({ edgeId, reason: `${side} endpoint: ${result.error}` });
      }
    } else if (result.locator.kind === "local") {
      locals.push({ refId: result.locator.id, edgeId, side, form: "compact" });
    }
  }
  // A broken endpoint drops the whole edge from the model; its refs must not
  // enter the dangling check (they are not parser-visible), only the report.
  if (!broken) out.push(...locals);
}

/** Trace refs from a flat 2.0.1 `<traceEdge from to>`. */
function flatRefs(edge: Node, out: TraceRef[]): void {
  const edgeId = attr(edge, "id") ?? "";
  const from = attr(edge, "from");
  const to = attr(edge, "to");
  if (from !== undefined) out.push({ refId: from, edgeId, side: "from", form: "flat" });
  if (to !== undefined) out.push({ refId: to, edgeId, side: "to", form: "flat" });
}

/** Collect declared ids, trace refs, and state machines over the whole tree. */
function walk(
  node: Node,
  declared: string[],
  refs: TraceRef[],
  machines: Node[],
  docErrors: DocRefError[],
  malformed: MalformedEdge[],
): void {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith(ATTR_PREFIX) || key === "#text") continue;
    for (const item of asArray<unknown>(value)) {
      if (!isNode(item)) continue;
      const id = attr(item, "id");
      if (id !== undefined && !REFERENCE_ELEMENTS.has(key)) declared.push(id);
      if (key === "edge") edgeRefs(item, refs, docErrors, malformed);
      else if (key === "traceEdge") flatRefs(item, refs);
      else if (key === "stateMachine") machines.push(item);
      walk(item, declared, refs, machines, docErrors, malformed);
    }
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Byte offset of the start of each line, for offset → line lookup. */
function lineStarts(xml: string): number[] {
  const starts = [0];
  for (let i = 0; i < xml.length; i++) if (xml[i] === "\n") starts.push(i + 1);
  return starts;
}

function lineAtOffset(starts: number[], offset: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const start = starts[mid];
    if (start !== undefined && start <= offset) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans + 1; // 1-based
}

/** 1-based source lines of every match of `re` (assumed global). */
function matchLines(xml: string, starts: number[], re: RegExp): number[] {
  const lines: number[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic global-regex exec loop
  while ((m = re.exec(xml)) !== null) {
    lines.push(lineAtOffset(starts, m.index));
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return lines;
}

/**
 * Check a .rqml document string for duplicate ids and dangling trace
 * references. Returns one diagnostic per offending id occurrence / trace
 * endpoint. Best-effort on well-formed input; malformed XML (already reported
 * by {@link parse}) yields no diagnostics here.
 */
export function checkIntegrity(xml: string): Diagnostic[] {
  let root: Node | undefined;
  try {
    const obj = parser.parse(xml) as Node;
    root = isNode(obj.rqml) ? obj.rqml : undefined;
  } catch {
    return [];
  }
  if (!root) return [];

  const declared: string[] = [];
  const refs: TraceRef[] = [];
  const machines: Node[] = [];
  const docErrors: DocRefError[] = [];
  const malformed: MalformedEdge[] = [];
  walk(root, declared, refs, machines, docErrors, malformed);

  const starts = lineStarts(xml);
  const diagnostics: Diagnostic[] = [];

  // Duplicate ids (xs:key allIds). Flag every redeclaration after the first.
  const counts = new Map<string, number>();
  for (const id of declared) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [id, count] of counts) {
    if (id === "" || count < 2) continue;
    const re = new RegExp(
      `<(?!local\\b|doc\\b)[A-Za-z][\\w.:-]*\\b[^>]*?\\sid\\s*=\\s*"${escapeRegExp(id)}"`,
      "g",
    );
    const lines = matchLines(xml, starts, re);
    const redeclLines = lines.length >= 2 ? lines.slice(1) : [undefined];
    for (const line of redeclLines) {
      const diag: Diagnostic = {
        source: "validate",
        severity: "error",
        rule: "duplicate-id",
        message: `Duplicate id "${id}": this id is already declared elsewhere in the document.`,
      };
      if (typeof line === "number") diag.line = line;
      diagnostics.push(diag);
    }
  }

  // Dangling trace endpoints (processor-enforced per RFC-0003; the 2.1.0
  // trace keyrefs were inert and are deleted in 2.2.0).
  const declaredSet = new Set(declared);
  for (const ref of refs) {
    if (ref.refId === "" || declaredSet.has(ref.refId)) continue;
    const re =
      ref.form === "flat"
        ? new RegExp(
            `<traceEdge\\b[^>]*?\\s${ref.side}\\s*=\\s*"${escapeRegExp(ref.refId)}"`,
            "g",
          )
        : ref.form === "compact"
          ? new RegExp(
              `<edge\\b[^>]*?\\s${ref.side}\\s*=\\s*"${escapeRegExp(ref.refId)}"`,
              "g",
            )
          : new RegExp(`<local\\b[^>]*?\\sid\\s*=\\s*"${escapeRegExp(ref.refId)}"`, "g");
    const lines = matchLines(xml, starts, re);
    const diag: Diagnostic = {
      source: "trace",
      severity: "error",
      rule: "unresolved-local-ref",
      message: `Trace edge "${ref.edgeId}" (${ref.side}) references unknown id "${ref.refId}".`,
    };
    if (lines.length > 0) diag.line = lines[0];
    diagnostics.push(diag);
  }

  // Edges the parser drops entirely (REQ-CORE-COMPACT-PARITY): incomplete
  // endpoint forms and malformed non-doc endpoint values must be reported,
  // never silently vanish from the trace graph.
  for (const bad of malformed) {
    const re = new RegExp(
      `<edge\\b[^>]*?\\bid\\s*=\\s*"${escapeRegExp(bad.edgeId)}"`,
      "g",
    );
    const lines = matchLines(xml, starts, re);
    const diag: Diagnostic = {
      source: "trace",
      severity: "error",
      rule: "malformed-trace-edge",
      message: `Trace edge "${bad.edgeId}": ${bad.reason}; the edge is not part of the trace graph.`,
    };
    if (lines.length > 0) diag.line = lines[0];
    diagnostics.push(diag);
  }

  // Malformed rqml: doc locators in compact endpoints (RFC-0003): a doc
  // reference without a valid target-id fragment must be reported, never
  // treated as an external URI.
  for (const err of docErrors) {
    const re = new RegExp(
      `<edge\\b[^>]*?\\s${err.side}\\s*=\\s*"${escapeRegExp(err.value)}"`,
      "g",
    );
    const lines = matchLines(xml, starts, re);
    const diag: Diagnostic = {
      source: "trace",
      severity: "error",
      rule: "invalid-doc-locator",
      message: `Trace edge "${err.edgeId}" (${err.side}): ${err.error}.`,
    };
    if (lines.length > 0) diag.line = lines[0];
    diagnostics.push(diag);
  }

  // State-machine reference integrity (REQ-CORE-SM-INTEGRITY). The XSD declares
  // smInitialRef and transition keyrefs, but they never fire for the same
  // namespace reason as allIds above, so: @initial and transition @from/@to
  // must resolve to states of the same machine, and final states must have no
  // outgoing transitions.
  for (const sm of machines) {
    const smId = attr(sm, "id") ?? "";
    const stateIds = new Set<string>();
    const finalStates = new Set<string>();
    for (const st of asArray<unknown>(sm.state).filter(isNode)) {
      const sid = attr(st, "id");
      if (sid === undefined) continue;
      stateIds.add(sid);
      if (attr(st, "type") === "final") finalStates.add(sid);
    }

    const initial = attr(sm, "initial");
    if (initial !== undefined && !stateIds.has(initial)) {
      const re = new RegExp(
        `<stateMachine\\b[^>]*?\\sinitial\\s*=\\s*"${escapeRegExp(initial)}"`,
        "g",
      );
      const lines = matchLines(xml, starts, re);
      const diag: Diagnostic = {
        source: "validate",
        severity: "error",
        rule: "unresolved-state-ref",
        message: `State machine "${smId}" initial state "${initial}" is not a declared state of the machine.`,
      };
      if (lines.length > 0) diag.line = lines[0];
      diagnostics.push(diag);
    }

    for (const tr of asArray<unknown>(sm.transition).filter(isNode)) {
      const trId = attr(tr, "id") ?? "";
      for (const side of ["from", "to"] as const) {
        const refId = attr(tr, side);
        if (refId === undefined || stateIds.has(refId)) continue;
        const re = new RegExp(
          `<transition\\b[^>]*?\\s${side}\\s*=\\s*"${escapeRegExp(refId)}"`,
          "g",
        );
        const lines = matchLines(xml, starts, re);
        const diag: Diagnostic = {
          source: "validate",
          severity: "error",
          rule: "unresolved-state-ref",
          message: `Transition "${trId}" (${side}) references unknown state "${refId}" in state machine "${smId}".`,
        };
        if (lines.length > 0) diag.line = lines[0];
        diagnostics.push(diag);
      }
      const from = attr(tr, "from");
      if (from !== undefined && finalStates.has(from)) {
        const re = new RegExp(
          `<transition\\b[^>]*?\\sid\\s*=\\s*"${escapeRegExp(trId)}"`,
          "g",
        );
        const lines = matchLines(xml, starts, re);
        const diag: Diagnostic = {
          source: "validate",
          severity: "error",
          rule: "final-state-outgoing",
          message: `Final state "${from}" has outgoing transition "${trId}" in state machine "${smId}".`,
        };
        if (lines.length > 0) diag.line = lines[0];
        diagnostics.push(diag);
      }
    }
  }

  return diagnostics;
}
