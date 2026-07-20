import { checkIntegrity } from "../analyze/integrity.js";
import type { TraceEdge } from "../model/types.js";
import { parse } from "../parse/parse.js";
import { formatConfidence, formatEndpointRef } from "../trace/endpoint.js";
import { maskComments } from "./comments.js";

/**
 * Document migration to the current schema version (REQ-LOOP-MIGRATE,
 * RFC-0003): rewrite the root element's version/namespace and re-emit every
 * trace edge in the canonical compact form, leaving every other byte of the
 * document untouched. The edit is textual — like edit/link.ts — so comments
 * and hand formatting survive and the migration diff is exactly "the root tag
 * changed and the trace section got shorter" (QGOAL-DIFF).
 */

export const MIGRATE_TARGET = "2.2.0";

export type MigrateResult =
  | {
      ok: true;
      xml: string;
      changed: boolean;
      fromVersion: string;
      toVersion: typeof MIGRATE_TARGET;
      edgesRewritten: number;
    }
  | { ok: false; error: string };

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Leading whitespace of the line containing `index`. */
function indentAt(xml: string, index: number): string {
  const start = xml.lastIndexOf("\n", index - 1) + 1;
  const prefix = xml.slice(start, index);
  return /^[ \t]*$/.test(prefix) ? prefix : "";
}

/**
 * The canonical compact form of one model edge. `notesXml` carries the
 * original `<notes>…</notes>` span verbatim when the source edge had one, so
 * any inline markup inside notes survives byte-exact.
 */
function compactEdgeText(edge: TraceEdge, indent: string, notesXml?: string): string {
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
  const open = `${indent}<edge ${parts.join(" ")}`;
  if (notesXml === undefined) return `${open}/>`;
  return `${open}>\n${indent}  ${notesXml}\n${indent}</edge>`;
}

/** Deep sort object keys so structural equality survives key-order differences. */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function stable(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

const NOTES_ELEMENT = /<notes\b[\s\S]*?<\/notes>/;

/**
 * Migrate a 2.0.1 or 2.1.0 document string to 2.2.0. Deterministic; a 2.2.0
 * input is returned unchanged. The result is guaranteed (by construction and
 * by guard) to parse to the identical trace model, and the edit never worsens
 * referential integrity.
 */
export function migrateDocument(xml: string): MigrateResult {
  const parsed = parse(xml);
  if (!parsed.ok) {
    return { ok: false, error: `document does not parse: ${parsed.error.message}` };
  }
  const doc = parsed.document;
  const fromVersion = doc.version;
  if (fromVersion === MIGRATE_TARGET) {
    return {
      ok: true,
      xml,
      changed: false,
      fromVersion,
      toVersion: MIGRATE_TARGET,
      edgesRewritten: 0,
    };
  }
  if (fromVersion !== "2.0.1" && fromVersion !== "2.1.0") {
    return { ok: false, error: `cannot migrate from unknown version "${fromVersion}"` };
  }

  // Duplicate edge ids would make textual span location ambiguous; they are
  // integrity errors anyway, so refuse and point at the real problem.
  const edgeIds = new Set<string>();
  for (const edge of doc.trace) {
    if (edgeIds.has(edge.id)) {
      return {
        ok: false,
        error: `duplicate edge id "${edge.id}"; fix integrity findings before migrating`,
      };
    }
    edgeIds.add(edge.id);
  }

  // All span location happens on comment-masked text, so an edge id (or a
  // whole commented-out edge) inside an XML comment can never absorb a
  // rewrite while the live edge is left behind. Splices read the original.
  const masked = maskComments(xml);

  // 1. Root element tag: version attribute, namespace URLs, XSD location.
  const rootMatch = /<rqml\b[^>]*>/.exec(masked);
  if (rootMatch === null) return { ok: false, error: "no <rqml> root element found" };
  const rootTag = xml
    .slice(rootMatch.index, rootMatch.index + rootMatch[0].length)
    .replaceAll(
      `https://rqml.org/schema/${fromVersion}`,
      `https://rqml.org/schema/${MIGRATE_TARGET}`,
    )
    .replaceAll(`rqml-${fromVersion}.xsd`, `rqml-${MIGRATE_TARGET}.xsd`)
    .replace(
      new RegExp(`version\\s*=\\s*(["'])${escapeRegExp(fromVersion)}\\1`),
      `version="${MIGRATE_TARGET}"`,
    );
  if (!rootTag.includes(`version="${MIGRATE_TARGET}"`)) {
    return { ok: false, error: "could not rewrite the root version attribute" };
  }
  let out = xml.slice(0, rootMatch.index) + rootTag;
  let cursor = rootMatch.index + rootMatch[0].length;

  // 2. Each trace edge, in document order, rewritten in place.
  let edgesRewritten = 0;
  for (const edge of doc.trace) {
    const open = new RegExp(
      `<(edge|traceEdge)\\b[^>]*\\bid="${escapeRegExp(edge.id)}"[^>]*>`,
    ).exec(masked.slice(cursor));
    if (open === null) {
      return {
        ok: false,
        error: `could not locate edge "${edge.id}" in the document text`,
      };
    }
    const start = cursor + open.index;
    const openText = open[0];
    let end: number;
    if (openText.endsWith("/>")) {
      end = start + openText.length;
    } else {
      const closeTag = `</${open[1]}>`;
      const closeIdx = masked.indexOf(closeTag, start);
      if (closeIdx < 0) {
        return { ok: false, error: `unclosed edge "${edge.id}" in the document text` };
      }
      end = closeIdx + closeTag.length;
    }
    const notesMatch = NOTES_ELEMENT.exec(masked.slice(start, end));
    const notesXml =
      notesMatch === null
        ? undefined
        : xml.slice(
            start + notesMatch.index,
            start + notesMatch.index + notesMatch[0].length,
          );
    out += xml.slice(cursor, start);
    out += compactEdgeText(edge, indentAt(xml, start), notesXml).trimStart();
    cursor = end;
    edgesRewritten++;
  }
  out += xml.slice(cursor);

  // Guards: the migrated text must parse to the identical trace model and
  // must not introduce integrity violations (REQ-CORE-COMPACT-PARITY).
  const reparsed = parse(out);
  if (!reparsed.ok) {
    return {
      ok: false,
      error: `migration produced an unparseable document: ${reparsed.error.message}`,
    };
  }
  if (stable(reparsed.document.trace) !== stable(doc.trace)) {
    return {
      ok: false,
      error: "migration changed the trace model; document left unchanged",
    };
  }
  if (checkIntegrity(out).length > checkIntegrity(xml).length) {
    return {
      ok: false,
      error: "migration introduced an integrity violation; document left unchanged",
    };
  }

  return {
    ok: true,
    xml: out,
    changed: true,
    fromVersion,
    toVersion: MIGRATE_TARGET,
    edgesRewritten,
  };
}
