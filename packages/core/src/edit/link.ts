import { checkIntegrity } from "../analyze/integrity.js";
import type { ReqStatus, TraceEdge, TraceType } from "../model/types.js";
import { parse } from "../parse/parse.js";
import {
  formatConfidence,
  formatEndpointRef,
  normalizeExternalUri,
} from "../trace/endpoint.js";
import { declaredIdIndex } from "../trace/index.js";
import { maskComments } from "./comments.js";

/**
 * Mechanical trace-link recording (REQ-LOOP-LINK) and maintenance
 * (REQ-LOOP-RELINK): append a schema-valid trace edge of any type between two
 * endpoints, or repoint an existing implements/verifiedBy edge's external
 * locator in place.
 *
 * The edits are textual — an edge block is inserted before `</trace>`, or one
 * locator element is replaced within its edge — rather than a parse/serialize
 * round-trip, so XML comments and hand formatting in the spec survive
 * untouched. The result is re-parsed and integrity-checked before being
 * returned; XSD validation is left to the caller, which keeps this entry
 * WASM-free.
 */

/** Every trace relationship the schema defines, as a runtime list. */
export const TRACE_TYPES: readonly TraceType[] = [
  "refines",
  "satisfies",
  "dependsOn",
  "conflictsWith",
  "threatens",
  "mitigates",
  "verifiedBy",
  "covers",
  "implements",
  "supersedes",
  "consumesInterface",
  "providesInterface",
  "conformsTo",
  "deprecates",
  "breaks",
];

export interface LinkRequest {
  /** Source endpoint: a declared local artifact id or an external locator URI. */
  from: string;
  /** Target endpoint: a declared local artifact id or an external locator URI. */
  to: string;
  /**
   * Trace relationship. `implements` is always recorded external → local and
   * `verifiedBy` local → external, whichever order the endpoints were given
   * in; every other type is recorded exactly from → to.
   */
  type: TraceType;
  /** Explicit edge id; derived from the type and local endpoint(s) when omitted. */
  edgeId?: string;
  /**
   * Locator @kind hint for the external endpoint; defaults to "code" for
   * implements and "test" for verifiedBy.
   */
  kind?: string;
  /** Locator @title hint for the external endpoint. */
  title?: string;
  /** Edge lifecycle status; new edges are stamped "draft" unless overridden. */
  status?: ReqStatus;
  /** Provenance identity; defaults to "rqml" (a toolchain-recorded edge). */
  createdBy?: string;
  /** Why this relationship exists; emitted as the edge's `<notes>` child. */
  notes?: string;
  /** Certainty of the relationship, 0.0–1.0. */
  confidence?: number;
  /** Category tags (NMTOKENs); emitted space-separated. */
  tags?: string[];
}

export type LinkResult =
  | { ok: true; xml: string; edgeId: string; edgeXml: string; from: string; to: string }
  | { ok: false; error: string };

const ID_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{1,79}$/;
const URI_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const NMTOKEN = /^[A-Za-z0-9._:-]+$/;
const STATUSES: readonly ReqStatus[] = ["draft", "review", "approved", "deprecated"];

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type Endpoint = { kind: "local"; id: string } | { kind: "external"; uri: string };

/**
 * Classify one endpoint string. A bare token is a declared local id or an
 * error — never silently an external locator, so a typoed id cannot escape
 * referential integrity as a dangling "URI".
 */
function classifyEndpoint(
  raw: string,
  declared: (id: string) => boolean,
): { ok: true; endpoint: Endpoint } | { ok: false; error: string } {
  const value = raw.trim();
  if (value === "") return { ok: false, error: "endpoint must not be empty" };
  if (value.toLowerCase().startsWith("rqml:")) {
    return {
      ok: false,
      error:
        "rqml: document locators are not supported by link yet; author the doc locator in the trace section directly",
    };
  }
  if (URI_SCHEME.test(value) || value.includes("/") || value.includes("\\")) {
    // Whitespace never fits an endpoint value (the 2.2.0 lexical space
    // excludes it, and the parser would drop the edge): refuse it here with a
    // real message instead of letting the write fail downstream.
    if (/\s/.test(value)) {
      return {
        ok: false,
        error: `locator uri "${value}" contains whitespace; percent-encode it (%20)`,
      };
    }
    return { ok: true, endpoint: { kind: "external", uri: normalizeExternalUri(value) } };
  }
  if (ID_PATTERN.test(value)) {
    if (declared(value)) return { ok: true, endpoint: { kind: "local", id: value } };
    return {
      ok: false,
      error: `"${value}" is not a declared artifact id (for an external locator, use a path like ./${value} or a file: URI)`,
    };
  }
  return { ok: true, endpoint: { kind: "external", uri: value } };
}

/**
 * Fix the orientation of the directional convention types. `implements`
 * points at the requirement (coverage counts the incoming edge) and
 * `verifiedBy` points at the test, whichever order the caller gave the
 * endpoints in; all other types mean exactly "from <type> to".
 */
function orient(
  type: TraceType,
  from: Endpoint,
  to: Endpoint,
): { ok: true; from: Endpoint; to: Endpoint } | { ok: false; error: string } {
  if (type !== "implements" && type !== "verifiedBy") return { ok: true, from, to };
  const local = from.kind === "local" ? from : to.kind === "local" ? to : undefined;
  const external =
    from.kind === "external" ? from : to.kind === "external" ? to : undefined;
  if (local === undefined || external === undefined) {
    return {
      ok: false,
      error: `${type} edges link one declared artifact and one external artifact (for a different relationship, pass --type)`,
    };
  }
  return type === "implements"
    ? { ok: true, from: external, to: local }
    : { ok: true, from: local, to: external };
}

const TYPE_TAG: Record<TraceType, string> = {
  refines: "REF",
  satisfies: "SAT",
  dependsOn: "DEP",
  conflictsWith: "CONFLICT",
  threatens: "THREAT",
  mitigates: "MIT",
  verifiedBy: "VER",
  covers: "COV",
  implements: "IMPL",
  supersedes: "SUPER",
  consumesInterface: "CONSUMES",
  providesInterface: "PROVIDES",
  conformsTo: "CONFORMS",
  deprecates: "DEPR",
  breaks: "BREAKS",
};

function idBase(id: string): string {
  return id.replace(/^REQ-/, "");
}

/** Cap an id at 76 chars, leaving room for a `-<n>` collision suffix within
 * the schema's 80-char limit, and never end on a dangling separator. */
function capId(base: string): string {
  return base.slice(0, 76).replace(/-+$/, "");
}

/**
 * The historical single-artifact edge id for implements/verifiedBy
 * (`E-IMPL-<id>` / `E-VER-<id>`, id sans `REQ-`). Both appendTraceEdge and
 * updateTraceEdge derive their default id through this one function so the
 * append→update roundtrip matches even for long artifact ids (REQ-LOOP-RELINK,
 * invariant: same derivation on both paths).
 */
function legacyEdgeId(type: "implements" | "verifiedBy", localId: string): string {
  return capId(`E-${TYPE_TAG[type]}-${idBase(localId)}`);
}

function deriveEdgeId(
  type: TraceType,
  from: Endpoint,
  to: Endpoint,
  taken: (id: string) => boolean,
): string {
  // implements/verifiedBy keep their historical single-artifact derivation:
  // REQ-LOOP-RELINK's default matching and existing baseline keys depend on it.
  let base: string;
  if (type === "implements" || type === "verifiedBy") {
    const local = from.kind === "local" ? from : (to as Endpoint & { kind: "local" });
    base = legacyEdgeId(type, local.id);
  } else {
    const parts = [from, to]
      .filter((e): e is Endpoint & { kind: "local" } => e.kind === "local")
      .map((e) => idBase(e.id));
    base = capId([`E-${TYPE_TAG[type]}`, ...parts].join("-"));
  }
  if (!taken(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken(candidate)) return candidate;
  }
}

function locatorXml(endpoint: Endpoint, kind?: string, title?: string): string {
  if (endpoint.kind === "local") return `<local id="${endpoint.id}"/>`;
  const kindAttr = kind !== undefined ? ` kind="${escapeAttr(kind)}"` : "";
  const titleAttr = title !== undefined ? ` title="${escapeAttr(title)}"` : "";
  return `<external uri="${escapeAttr(endpoint.uri)}"${kindAttr}${titleAttr}/>`;
}

function edgeMetaAttrs(request: LinkRequest): string {
  const status = request.status ?? "draft";
  const createdBy = request.createdBy ?? "rqml";
  return [
    ...(request.confidence !== undefined
      ? [`confidence="${formatConfidence(request.confidence)}"`]
      : []),
    `status="${status}"`,
    `createdBy="${escapeAttr(createdBy)}"`,
    ...(request.tags !== undefined && request.tags.length > 0
      ? [`tags="${escapeAttr(request.tags.join(" "))}"`]
      : []),
  ].join(" ");
}

function requestKind(request: LinkRequest): string | undefined {
  const defaultKind =
    request.type === "implements"
      ? "code"
      : request.type === "verifiedBy"
        ? "test"
        : undefined;
  return request.kind ?? defaultKind;
}

/** Nested 2.1.0 edge block. */
function edgeBlock(
  request: LinkRequest,
  from: Endpoint,
  to: Endpoint,
  edgeId: string,
  indent: string,
): string {
  const kind = requestKind(request);
  const lines = [
    `${indent}<edge id="${edgeId}" type="${request.type}" ${edgeMetaAttrs(request)}>`,
    `${indent}  <from><locator>${locatorXml(from, kind, request.title)}</locator></from>`,
    `${indent}  <to><locator>${locatorXml(to, kind, request.title)}</locator></to>`,
    ...(request.notes !== undefined
      ? [`${indent}  <notes>${escapeText(request.notes)}</notes>`]
      : []),
    `${indent}</edge>`,
  ];
  return lines.join("\n");
}

/** One compact endpoint as attribute text: value plus its hint attributes. */
function compactEndpointAttrs(
  side: "from" | "to",
  endpoint: Endpoint,
  kind?: string,
  title?: string,
): string {
  const parts = [`${side}="${escapeAttr(formatEndpointRef(endpoint))}"`];
  // Hints apply to the external endpoint (matching the 2.1.0 emission).
  if (endpoint.kind === "external") {
    if (kind !== undefined) parts.push(`${side}Kind="${escapeAttr(kind)}"`);
    if (title !== undefined) parts.push(`${side}Title="${escapeAttr(title)}"`);
  }
  return parts.join(" ");
}

/**
 * Canonical compact open tag rebuilt from a model edge — used when repointing
 * a compact edge in place (REQ-LOOP-RELINK on 2.2.0 documents).
 */
function compactOpenTag(edge: TraceEdge, selfClosing: boolean): string {
  const parts = [`id="${edge.id}"`, `type="${edge.type}"`];
  for (const side of ["from", "to"] as const) {
    const loc = edge[side];
    parts.push(`${side}="${escapeAttr(formatEndpointRef(loc))}"`);
    if (loc.hintKind !== undefined) {
      parts.push(`${side}Kind="${escapeAttr(loc.hintKind)}"`);
    }
    if (loc.title !== undefined) parts.push(`${side}Title="${escapeAttr(loc.title)}"`);
  }
  if (edge.confidence !== undefined) {
    parts.push(`confidence="${formatConfidence(edge.confidence)}"`);
  }
  if (edge.status !== undefined) parts.push(`status="${edge.status}"`);
  if (edge.createdBy !== undefined) {
    parts.push(`createdBy="${escapeAttr(edge.createdBy)}"`);
  }
  if (edge.createdAt !== undefined) {
    parts.push(`createdAt="${escapeAttr(edge.createdAt)}"`);
  }
  if (edge.tags && edge.tags.length > 0) {
    parts.push(`tags="${escapeAttr(edge.tags.join(" "))}"`);
  }
  return `<edge ${parts.join(" ")}${selfClosing ? "/>" : ">"}`;
}

/** Compact 2.2.0 edge (RFC-0003): canonical attribute order, one line unless notes. */
function compactEdgeBlock(
  request: LinkRequest,
  from: Endpoint,
  to: Endpoint,
  edgeId: string,
  indent: string,
): string {
  const kind = requestKind(request);
  const attrs = [
    `id="${edgeId}"`,
    `type="${request.type}"`,
    compactEndpointAttrs("from", from, kind, request.title),
    compactEndpointAttrs("to", to, kind, request.title),
    edgeMetaAttrs(request),
  ].join(" ");
  const open = `${indent}<edge ${attrs}`;
  if (request.notes === undefined) return `${open}/>`;
  return [
    `${open}>`,
    `${indent}  <notes>${escapeText(request.notes)}</notes>`,
    `${indent}</edge>`,
  ].join("\n");
}

/** Start-of-line offset and leading whitespace of the line containing `index`. */
function lineInfo(xml: string, index: number): { start: number; indent: string } {
  const start = xml.lastIndexOf("\n", index - 1) + 1;
  const prefix = xml.slice(start, index);
  return { start, indent: /^[ \t]*$/.test(prefix) ? prefix : "" };
}

function validateExtras(request: LinkRequest): string | undefined {
  if (!TRACE_TYPES.includes(request.type)) {
    return `unknown trace type "${request.type}"`;
  }
  if (request.status !== undefined && !STATUSES.includes(request.status)) {
    return `unknown status "${request.status}" (${STATUSES.join("|")})`;
  }
  if (
    request.confidence !== undefined &&
    !(
      Number.isFinite(request.confidence) &&
      request.confidence >= 0 &&
      request.confidence <= 1
    )
  ) {
    return `confidence must be a number between 0 and 1, got "${request.confidence}"`;
  }
  if (request.createdBy !== undefined && request.createdBy.trim() === "") {
    return "createdBy must not be empty";
  }
  for (const tag of request.tags ?? []) {
    if (!NMTOKEN.test(tag)) {
      return `tag "${tag}" is not a valid NMTOKEN (letters, digits, ".", "_", "-", ":")`;
    }
  }
  return undefined;
}

/**
 * Append a trace edge to the document text. Deterministic: the same document
 * and request always produce the same edge id and output — which is why the
 * provenance stamp is status/createdBy, never a createdAt timestamp.
 */
export function appendTraceEdge(xml: string, request: LinkRequest): LinkResult {
  const parsed = parse(xml);
  if (!parsed.ok) {
    return { ok: false, error: `document does not parse: ${parsed.error.message}` };
  }
  const extrasError = validateExtras(request);
  if (extrasError !== undefined) return { ok: false, error: extrasError };

  const idIndex = declaredIdIndex(parsed.document);
  const declared = (id: string) => idIndex.has(id);
  const fromResult = classifyEndpoint(request.from, declared);
  if (!fromResult.ok) return { ok: false, error: `from endpoint: ${fromResult.error}` };
  const toResult = classifyEndpoint(request.to, declared);
  if (!toResult.ok) return { ok: false, error: `to endpoint: ${toResult.error}` };

  const oriented = orient(request.type, fromResult.endpoint, toResult.endpoint);
  if (!oriented.ok) return { ok: false, error: oriented.error };
  const { from, to } = oriented;
  if (from.kind !== "local" && to.kind !== "local") {
    return {
      ok: false,
      error: "at least one endpoint must be a declared artifact in this document",
    };
  }
  if (
    (request.kind !== undefined || request.title !== undefined) &&
    from.kind !== "external" &&
    to.kind !== "external"
  ) {
    return { ok: false, error: "kind and title hints apply to an external endpoint" };
  }

  let edgeId: string;
  if (request.edgeId !== undefined) {
    if (!ID_PATTERN.test(request.edgeId)) {
      return {
        ok: false,
        error: `edge id "${request.edgeId}" does not match the RQML id pattern`,
      };
    }
    if (idIndex.has(request.edgeId)) {
      return { ok: false, error: `edge id "${request.edgeId}" is already declared` };
    }
    edgeId = request.edgeId;
  } else {
    edgeId = deriveEdgeId(request.type, from, to, declared);
  }

  // 2.0.1/2.1.0 documents get the nested block their schema expects; 2.2.0
  // and later get the compact form (RFC-0003).
  const legacyDoc =
    parsed.document.version === "2.0.1" || parsed.document.version === "2.1.0";
  const block = legacyDoc ? edgeBlock : compactEdgeBlock;

  // Anchors are located on comment-masked text so a "</trace>" or
  // "<governance" inside an XML comment can never misplace the edit.
  const masked = maskComments(xml);
  let updated: string;
  let edgeXml: string;
  const closeIdx = masked.lastIndexOf("</trace>");
  if (closeIdx >= 0) {
    const { start, indent } = lineInfo(xml, closeIdx);
    edgeXml = block(request, from, to, edgeId, `${indent}  `);
    updated = `${xml.slice(0, start)}${edgeXml}\n${xml.slice(start)}`;
  } else {
    // No trace section yet: create one in its fixed position, before
    // governance when present, else before the document close.
    const anchorIdx = (() => {
      const gov = masked.indexOf("<governance");
      return gov >= 0 ? gov : masked.lastIndexOf("</rqml>");
    })();
    if (anchorIdx < 0) return { ok: false, error: "no </rqml> close tag found" };
    const { start, indent } = lineInfo(xml, anchorIdx);
    const sectionIndent = indent === "" ? "  " : indent;
    edgeXml = block(request, from, to, edgeId, `${sectionIndent}  `);
    const section = `${sectionIndent}<trace>\n${edgeXml}\n${sectionIndent}</trace>\n`;
    updated = `${xml.slice(0, start)}${section}${xml.slice(start)}`;
  }

  const before = checkIntegrity(xml).length;
  const reparsed = parse(updated);
  if (!reparsed.ok) {
    return {
      ok: false,
      error: `edit produced an unparseable document: ${reparsed.error.message}`,
    };
  }
  if (checkIntegrity(updated).length > before) {
    return {
      ok: false,
      error: "edit introduced an integrity violation; document left unchanged",
    };
  }

  return {
    ok: true,
    xml: updated,
    edgeId,
    edgeXml: edgeXml.trim(),
    from: from.kind === "local" ? from.id : from.uri,
    to: to.kind === "local" ? to.id : to.uri,
  };
}

export interface UpdateLinkRequest {
  /** Declared local artifact id the edge must link. */
  artifactId: string;
  /** Replacement external locator URI. */
  uri: string;
  type: "implements" | "verifiedBy";
  /** Explicit edge id; matched by the append-time derivation when omitted. */
  edgeId?: string;
  /** Locator @kind; the edge's existing kind is preserved when omitted. */
  kind?: string;
  /** Locator @title; the edge's existing title is preserved when omitted. */
  title?: string;
}

export type UpdateLinkResult =
  | { ok: true; xml: string; edgeId: string; edgeXml: string; previousUri: string }
  | { ok: false; error: string };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const EXTERNAL_ELEMENT = /<external\b[^>]*(?:\/>|>[\s\S]*?<\/external>)/g;

/**
 * Replace the external locator of an existing `implements`/`verifiedBy` edge
 * (REQ-LOOP-RELINK). Only the locator element changes; the edge id, type,
 * orientation, and everything else in the document are left untouched.
 * Deterministic: the same document and request always produce the same output.
 */
export function updateTraceEdge(
  xml: string,
  request: UpdateLinkRequest,
): UpdateLinkResult {
  const parsed = parse(xml);
  if (!parsed.ok) {
    return { ok: false, error: `document does not parse: ${parsed.error.message}` };
  }
  if (request.uri.trim() === "") {
    return { ok: false, error: "locator uri must not be empty" };
  }

  const edgeId = request.edgeId ?? legacyEdgeId(request.type, request.artifactId);
  const edge: TraceEdge | undefined = parsed.document.trace.find((e) => e.id === edgeId);
  if (edge === undefined) {
    return {
      ok: false,
      error:
        request.edgeId !== undefined
          ? `no trace edge with id "${edgeId}" exists`
          : `no trace edge with the derived id "${edgeId}" exists; pass --id for an explicitly named edge`,
    };
  }
  if (edge.type !== request.type) {
    return {
      ok: false,
      error: `edge "${edgeId}" has type "${edge.type}", not "${request.type}"`,
    };
  }
  const local =
    edge.from.kind === "local"
      ? edge.from
      : edge.to.kind === "local"
        ? edge.to
        : undefined;
  if (local === undefined || local.id !== request.artifactId) {
    return {
      ok: false,
      error: `edge "${edgeId}" does not link artifact "${request.artifactId}"`,
    };
  }
  const external =
    edge.from.kind === "external"
      ? edge.from
      : edge.to.kind === "external"
        ? edge.to
        : undefined;
  if (external === undefined) {
    return { ok: false, error: `edge "${edgeId}" has no external locator to update` };
  }

  // Locate on comment-masked text: a commented-out copy of the edge must
  // never absorb the repoint while the live edge stays stale.
  const masked = maskComments(xml);
  const openTag = new RegExp(`<edge\\b[^>]*\\bid="${escapeRegExp(edgeId)}"[^>]*>`);
  const open = openTag.exec(masked);
  if (open === null) {
    return { ok: false, error: `could not locate edge "${edgeId}" in the document text` };
  }

  const kind =
    request.kind ??
    external.hintKind ??
    (request.type === "implements" ? "code" : "test");
  const title = request.title ?? external.title;

  let updated: string;
  let edgeXml: string;
  const openText = open[0];
  if (/\sfrom\s*=\s*"/.test(openText)) {
    // Compact 2.2.0 edge: every endpoint lives in the open tag, which is
    // tool-emitted and cannot hold comments — rebuild it canonically from the
    // model with the external side repointed.
    const repointed: TraceEdge["from"] = {
      kind: "external",
      uri: request.uri,
      hintKind: kind,
    };
    if (title !== undefined) repointed.title = title;
    const newEdge: TraceEdge = {
      ...edge,
      from: edge.from === external ? repointed : edge.from,
      to: edge.to === external ? repointed : edge.to,
    };
    const selfClosing = openText.endsWith("/>");
    edgeXml = compactOpenTag(newEdge, selfClosing);
    updated =
      xml.slice(0, open.index) + edgeXml + xml.slice(open.index + openText.length);
  } else {
    // Close tag and locator are located on the masked text too; the splice
    // itself always operates on the original.
    const closeIdx = masked.indexOf("</edge>", open.index);
    if (closeIdx < 0) {
      return {
        ok: false,
        error: `could not locate edge "${edgeId}" in the document text`,
      };
    }
    const spanMasked = masked.slice(open.index, closeIdx);
    EXTERNAL_ELEMENT.lastIndex = 0;
    const occurrences: RegExpExecArray[] = [];
    let match: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic global-regex exec loop
    while ((match = EXTERNAL_ELEMENT.exec(spanMasked)) !== null) occurrences.push(match);
    const target = occurrences[0];
    if (occurrences.length !== 1 || target === undefined) {
      return {
        ok: false,
        error: `edge "${edgeId}" does not contain exactly one external locator element`,
      };
    }
    const titleAttr = title !== undefined ? ` title="${escapeAttr(title)}"` : "";
    const replacement = `<external uri="${escapeAttr(request.uri)}" kind="${escapeAttr(kind)}"${titleAttr}/>`;
    const absStart = open.index + target.index;
    const absEnd = absStart + target[0].length;
    updated = xml.slice(0, absStart) + replacement + xml.slice(absEnd);
    edgeXml =
      `${xml.slice(open.index, absStart)}${replacement}${xml.slice(absEnd, closeIdx)}</edge>`.trim();
  }

  const before = checkIntegrity(xml).length;
  const reparsed = parse(updated);
  if (!reparsed.ok) {
    return {
      ok: false,
      error: `edit produced an unparseable document: ${reparsed.error.message}`,
    };
  }
  if (checkIntegrity(updated).length > before) {
    return {
      ok: false,
      error: "edit introduced an integrity violation; document left unchanged",
    };
  }

  return {
    ok: true,
    xml: updated,
    edgeId,
    edgeXml,
    previousUri: external.uri,
  };
}
