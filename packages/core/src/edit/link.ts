import { checkIntegrity } from "../analyze/integrity.js";
import { parse } from "../parse/parse.js";
import { declaredIdIndex } from "../trace/index.js";

/**
 * Mechanical trace-link recording (REQ-LOOP-LINK): append a schema-valid
 * `implements` or `verifiedBy` edge to a document's trace section.
 *
 * The edit is textual — the edge block is inserted before `</trace>` — rather
 * than a parse/serialize round-trip, so XML comments and hand formatting in
 * the spec survive untouched. The result is re-parsed and integrity-checked
 * before being returned; XSD validation is left to the caller, which keeps
 * this entry WASM-free.
 */

export interface LinkRequest {
  /** Declared local artifact id, usually a requirement. */
  artifactId: string;
  /** External locator URI of the code or test artifact (repo-relative path, file:, …). */
  uri: string;
  type: "implements" | "verifiedBy";
  /** Explicit edge id; derived from the artifact id when omitted. */
  edgeId?: string;
  /** Locator @kind hint; defaults to "code" for implements, "test" for verifiedBy. */
  kind?: string;
  /** Locator @title hint. */
  title?: string;
}

export type LinkResult =
  | { ok: true; xml: string; edgeId: string; edgeXml: string }
  | { ok: false; error: string };

const ID_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{1,79}$/;

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function deriveEdgeId(
  type: LinkRequest["type"],
  artifactId: string,
  taken: (id: string) => boolean,
): string {
  const prefix = type === "implements" ? "E-IMPL-" : "E-VER-";
  const base = prefix + artifactId.replace(/^REQ-/, "");
  if (!taken(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken(candidate)) return candidate;
  }
}

function edgeBlock(request: LinkRequest, edgeId: string, indent: string): string {
  const kind = request.kind ?? (request.type === "implements" ? "code" : "test");
  const titleAttr =
    request.title !== undefined ? ` title="${escapeAttr(request.title)}"` : "";
  const external = `<external uri="${escapeAttr(request.uri)}" kind="${escapeAttr(kind)}"${titleAttr}/>`;
  const local = `<local id="${request.artifactId}"/>`;
  // implements: code → requirement (coverage counts the incoming edge);
  // verifiedBy: requirement → test.
  const [from, to] =
    request.type === "implements" ? [external, local] : [local, external];
  return [
    `${indent}<edge id="${edgeId}" type="${request.type}">`,
    `${indent}  <from><locator>${from}</locator></from>`,
    `${indent}  <to><locator>${to}</locator></to>`,
    `${indent}</edge>`,
  ].join("\n");
}

/** Start-of-line offset and leading whitespace of the line containing `index`. */
function lineInfo(xml: string, index: number): { start: number; indent: string } {
  const start = xml.lastIndexOf("\n", index - 1) + 1;
  const prefix = xml.slice(start, index);
  return { start, indent: /^[ \t]*$/.test(prefix) ? prefix : "" };
}

/**
 * Append a trace edge to the document text. Deterministic: the same document
 * and request always produce the same edge id and output.
 */
export function appendTraceEdge(xml: string, request: LinkRequest): LinkResult {
  const parsed = parse(xml);
  if (!parsed.ok) {
    return { ok: false, error: `document does not parse: ${parsed.error.message}` };
  }
  const idIndex = declaredIdIndex(parsed.document);
  if (!idIndex.has(request.artifactId)) {
    return {
      ok: false,
      error: `artifact "${request.artifactId}" is not declared in the document`,
    };
  }
  if (request.uri.trim() === "") {
    return { ok: false, error: "locator uri must not be empty" };
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
    edgeId = deriveEdgeId(request.type, request.artifactId, (id) => idIndex.has(id));
  }

  let updated: string;
  let edgeXml: string;
  const closeIdx = xml.lastIndexOf("</trace>");
  if (closeIdx >= 0) {
    const { start, indent } = lineInfo(xml, closeIdx);
    edgeXml = edgeBlock(request, edgeId, `${indent}  `);
    updated = `${xml.slice(0, start)}${edgeXml}\n${xml.slice(start)}`;
  } else {
    // No trace section yet: create one in its fixed position, before
    // governance when present, else before the document close.
    const anchorIdx = (() => {
      const gov = xml.indexOf("<governance");
      return gov >= 0 ? gov : xml.lastIndexOf("</rqml>");
    })();
    if (anchorIdx < 0) return { ok: false, error: "no </rqml> close tag found" };
    const { start, indent } = lineInfo(xml, anchorIdx);
    const sectionIndent = indent === "" ? "  " : indent;
    edgeXml = edgeBlock(request, edgeId, `${sectionIndent}  `);
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

  return { ok: true, xml: updated, edgeId, edgeXml: edgeXml.trim() };
}
