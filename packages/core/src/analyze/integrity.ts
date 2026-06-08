import { XMLParser } from "fast-xml-parser";
import type { Diagnostic } from "../model/diagnostic.js";

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
  /** true for the flat 2.0.1 `<traceEdge from to>` form, false for nested `<edge>`. */
  flat: boolean;
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
    if (refId !== undefined) out.push({ refId, edgeId, side, flat: false });
  }
}

/** Trace refs from a flat 2.0.1 `<traceEdge from to>`. */
function flatRefs(edge: Node, out: TraceRef[]): void {
  const edgeId = attr(edge, "id") ?? "";
  const from = attr(edge, "from");
  const to = attr(edge, "to");
  if (from !== undefined) out.push({ refId: from, edgeId, side: "from", flat: true });
  if (to !== undefined) out.push({ refId: to, edgeId, side: "to", flat: true });
}

/** Collect declared ids and trace refs over the whole tree. */
function walk(node: Node, declared: string[], refs: TraceRef[]): void {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith(ATTR_PREFIX) || key === "#text") continue;
    for (const item of asArray<unknown>(value)) {
      if (!isNode(item)) continue;
      const id = attr(item, "id");
      if (id !== undefined && !REFERENCE_ELEMENTS.has(key)) declared.push(id);
      if (key === "edge") nestedRefs(item, refs);
      else if (key === "traceEdge") flatRefs(item, refs);
      walk(item, declared, refs);
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
  walk(root, declared, refs);

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

  // Dangling trace endpoints (xs:keyref traceFromRef / traceToRef).
  const declaredSet = new Set(declared);
  for (const ref of refs) {
    if (ref.refId === "" || declaredSet.has(ref.refId)) continue;
    const re = ref.flat
      ? new RegExp(
          `<traceEdge\\b[^>]*?\\s${ref.side}\\s*=\\s*"${escapeRegExp(ref.refId)}"`,
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

  return diagnostics;
}
