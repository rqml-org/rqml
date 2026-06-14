/**
 * Status-transition edit (REQ-CORE-SETSTATUS): change a declared artifact's
 * lifecycle `status` attribute in the document text in place. Mirrors
 * {@link appendTraceEdge} in edit/link.ts — a textual edit (so comments and
 * hand formatting survive, QGOAL-DIFF), re-parsed and integrity-checked before
 * being returned, and rejected if it would not parse or would introduce an
 * integrity violation. Deterministic: the same document and request always
 * produce the same output.
 */

import { checkIntegrity } from "../analyze/integrity.js";
import { parse } from "../parse/parse.js";
import { declaredIdIndex } from "../trace/index.js";

/** The RQML lifecycle status vocabulary (StatusType). */
export const STATUS_VALUES = ["draft", "review", "approved", "deprecated"] as const;
export type StatusValue = (typeof STATUS_VALUES)[number];

export interface SetStatusRequest {
  /** Declared artifact id (requirement, goal, …) whose status to change. */
  artifactId: string;
  /** Target lifecycle status. */
  status: string;
}

export type SetStatusResult =
  | { ok: true; xml: string; previousStatus?: string }
  | { ok: false; error: string };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Transition the lifecycle status of `artifactId` to `status`. The edit changes
 * only that element's opening tag; everything else in the document is byte-
 * identical. A no-op (already at the target status) returns the input unchanged.
 */
export function setStatus(xml: string, request: SetStatusRequest): SetStatusResult {
  if (!(STATUS_VALUES as readonly string[]).includes(request.status)) {
    return {
      ok: false,
      error: `invalid status "${request.status}" (${STATUS_VALUES.join(" | ")})`,
    };
  }
  const parsed = parse(xml);
  if (!parsed.ok) {
    return { ok: false, error: `document does not parse: ${parsed.error.message}` };
  }
  const ref = declaredIdIndex(parsed.document).get(request.artifactId);
  if (ref === undefined) {
    return {
      ok: false,
      error: `artifact "${request.artifactId}" is not declared in the document`,
    };
  }

  // Locate the element's opening tag: <kind … id="artifactId" …>. The kind from
  // the id index is the element name (req, goal, qgoal, …), which keeps this off
  // the trace <local id="…"/> locators that also mention the id.
  const openTag = new RegExp(
    `<${escapeRegExp(ref.kind)}\\b[^>]*\\bid="${escapeRegExp(request.artifactId)}"[^>]*>`,
  );
  const match = openTag.exec(xml);
  if (match === null) {
    return {
      ok: false,
      error: `could not locate the <${ref.kind}> element for "${request.artifactId}" in the document text`,
    };
  }
  const tag = match[0];

  const statusAttr = /\sstatus="([^"]*)"/;
  const existing = statusAttr.exec(tag);
  let newTag: string;
  let previousStatus: string | undefined;
  if (existing) {
    previousStatus = existing[1];
    if (previousStatus === request.status) return { ok: true, xml, previousStatus };
    newTag = tag.replace(statusAttr, () => ` status="${request.status}"`);
  } else {
    const idAttr = `id="${request.artifactId}"`;
    newTag = tag.replace(idAttr, () => `${idAttr} status="${request.status}"`);
  }

  const updated =
    xml.slice(0, match.index) + newTag + xml.slice(match.index + tag.length);

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

  return previousStatus !== undefined
    ? { ok: true, xml: updated, previousStatus }
    : { ok: true, xml: updated };
}
