import type { DocLocator, Locator } from "../model/types.js";

/**
 * The compact trace-endpoint micro-syntax (RFC-0003), shared by every
 * consumer that reads or writes it — parse, serialize, integrity, link — so
 * there is exactly one implementation of the grammar and the parse/integrity
 * parity requirement (REQ-CORE-COMPACT-PARITY) cannot be broken by grammar
 * drift between them.
 *
 *   local    — bare IdType token:  REQ-A
 *   doc      — rqml:<doc-uri>#<id>[;version=V][;git=SHA][;docId=D]
 *   external — any other scheme URI (file:src/a.ts), or a schemeless
 *              relative path containing "/" (packages/core/src/a.ts#L10)
 *
 * The doc fragment is split at the LAST "#", so a doc URI may itself contain
 * "#"; pin values may not (nor ";" or whitespace), which keeps the split
 * unambiguous.
 */

export const ENDPOINT_ID = /^[A-Za-z][A-Za-z0-9._-]{1,79}$/;
export const ENDPOINT_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const PIN_VALUE = /^[^;#\s]+$/;
const DOC_PIN_KEYS = ["version", "git", "docId"] as const;

export type EndpointParseResult =
  | { ok: true; locator: Locator }
  | { ok: false; error: string };

interface EndpointHints {
  kind?: string;
  title?: string;
}

function withHints(locator: Locator, hints?: EndpointHints): Locator {
  if (hints?.kind !== undefined) locator.hintKind = hints.kind;
  if (hints?.title !== undefined) locator.title = hints.title;
  return locator;
}

/**
 * Parse one compact endpoint value into a locator. A bare token that is not
 * IdType-shaped, or a malformed rqml: reference, is an error — never silently
 * an external locator (REQ-CORE-COMPACT-PARITY: a broken doc reference must
 * not masquerade as an unresolvable-but-legal external URI).
 */
export function parseEndpointRef(
  raw: string,
  hints?: EndpointHints,
): EndpointParseResult {
  const value = raw.trim();
  if (value === "") return { ok: false, error: "endpoint must not be empty" };

  if (/^rqml:/i.test(value)) {
    const rest = value.slice("rqml:".length);
    const hash = rest.lastIndexOf("#");
    if (hash < 0) {
      return {
        ok: false,
        error: `doc locator "${value}" has no #<id> fragment`,
      };
    }
    const uri = rest.slice(0, hash);
    if (uri === "") {
      return { ok: false, error: `doc locator "${value}" has no document URI` };
    }
    const fragment = rest.slice(hash + 1);
    const [id, ...pinParts] = fragment.split(";");
    if (id === undefined || !ENDPOINT_ID.test(id)) {
      return {
        ok: false,
        error: `doc locator "${value}" fragment does not start with a valid target id`,
      };
    }
    const out: DocLocator = { kind: "doc", uri, id };
    const seen = new Set<string>();
    for (const part of pinParts) {
      const eq = part.indexOf("=");
      const key = eq < 0 ? part : part.slice(0, eq);
      const pinValue = eq < 0 ? "" : part.slice(eq + 1);
      if (!(DOC_PIN_KEYS as readonly string[]).includes(key)) {
        return {
          ok: false,
          error: `doc locator "${value}" has unknown pin "${key}" (version|git|docId)`,
        };
      }
      if (seen.has(key)) {
        return { ok: false, error: `doc locator "${value}" repeats pin "${key}"` };
      }
      seen.add(key);
      if (!PIN_VALUE.test(pinValue)) {
        return {
          ok: false,
          error: `doc locator "${value}" pin "${key}" has an invalid value`,
        };
      }
      if (key === "docId" && !ENDPOINT_ID.test(pinValue)) {
        return {
          ok: false,
          error: `doc locator "${value}" docId is not a valid id`,
        };
      }
      if (key === "version") out.version = pinValue;
      else if (key === "git") out.git = pinValue;
      else out.docId = pinValue;
    }
    return { ok: true, locator: withHints(out, hints) };
  }

  if (ENDPOINT_SCHEME.test(value)) {
    return { ok: true, locator: withHints({ kind: "external", uri: value }, hints) };
  }
  // Note: only "/" makes a path — the 2.2.0 XSD's TracePathRef requires it,
  // and the processor must not accept endpoints the schema rejects.
  if (value.includes("/")) {
    if (/\s/.test(value)) {
      return { ok: false, error: `endpoint "${value}" contains whitespace` };
    }
    return {
      ok: true,
      locator: withHints({ kind: "external", uri: normalizeExternalUri(value) }, hints),
    };
  }
  if (ENDPOINT_ID.test(value)) {
    return { ok: true, locator: withHints({ kind: "local", id: value }, hints) };
  }
  return {
    ok: false,
    error: `endpoint "${value}" is neither an id, a URI, nor a relative path`,
  };
}

/**
 * Canonical model form of a schemeless external uri: one leading "./" is
 * syntactic armor (see formatEndpointRef), never part of the uri, so it is
 * stripped wherever an external uri enters the model — compact values and
 * 2.1.0 nested attributes alike — keeping format→parse model-stable.
 * "../" keeps its meaning and is untouched.
 */
export function normalizeExternalUri(uri: string): string {
  if (ENDPOINT_SCHEME.test(uri)) return uri;
  return uri.startsWith("./") ? uri.slice(2) : uri;
}

/**
 * The inverse: render a locator as its compact endpoint value. Hints
 * (hintKind/title) are NOT part of the value — they serialize as the
 * fromKind/fromTitle/toKind/toTitle attributes.
 */
export function formatEndpointRef(locator: Locator): string {
  switch (locator.kind) {
    case "local":
      return locator.id;
    case "external": {
      const uri = normalizeExternalUri(locator.uri);
      // A bare schemeless, slashless uri (legal in the 2.1.0 element form)
      // would read as a local id in compact form; "./" makes it a path with
      // identical filesystem resolution.
      if (!ENDPOINT_SCHEME.test(uri) && !uri.includes("/")) {
        return `./${uri}`;
      }
      return uri;
    }
    case "doc": {
      const pins = [
        locator.version !== undefined ? `;version=${locator.version}` : "",
        locator.git !== undefined ? `;git=${locator.git}` : "",
        locator.docId !== undefined ? `;docId=${locator.docId}` : "",
      ].join("");
      return `rqml:${locator.uri}#${locator.id}${pins}`;
    }
  }
}

/**
 * Render a confidence as a plain decimal: ConfidenceType is xs:decimal, which
 * rejects exponential notation, so `1e-7` must serialize as `0.0000001`.
 */
export function formatConfidence(value: number): string {
  const plain = String(value);
  if (!/[eE]/.test(plain)) return plain;
  return value.toFixed(20).replace(/0+$/, "").replace(/\.$/, "");
}
