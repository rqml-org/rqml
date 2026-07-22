import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

/**
 * Fragment-scoped evidence for drift detection (REQ-CORE-DRIFT-SCOPE, ADR-0018).
 *
 * A drift baseline hashes the whole file a locator points at, so a version bump
 * anywhere in `packages/cli/package.json` drifts an edge that claims to be about
 * `#bin`. This module supplies the second, narrower hash that lets
 * {@link ../check/drift.js} tell "the evidence changed" from "the file around
 * the evidence changed".
 *
 * Two rules keep the layer honest, and both are load-bearing:
 *
 *   1. **It only ever downgrades.** The whole-file hash remains the detector;
 *      nothing here can make a changed file look unchanged, only reclassify an
 *      alarm the file hash already raised. Every failure below therefore
 *      returns a reason rather than a hash, and the caller keeps the alarm.
 *   2. **Only exactly-resolvable media types.** JSON is interpreted because
 *      `JSON.parse` is exact and built in. TypeScript, JavaScript and XSD
 *      fragments are deliberately NOT interpreted — a heuristic that picks the
 *      wrong span yields a stable hash over the wrong bytes, which is
 *      under-detection, the one failure mode the gate cannot afford.
 */

/** Why a fragment could not be narrowed. Surfaced only for diagnostics. */
export interface FragmentFailure {
  ok: false;
  reason: string;
}

export type FragmentResolution = { ok: true; value: unknown } | FragmentFailure;
export type FragmentHash = { ok: true; hash: string } | FragmentFailure;

const fail = (reason: string): FragmentFailure => ({ ok: false, reason });

/**
 * The fragment of a locator, or `undefined` when it names none. Splits at the
 * first `#`, matching how the drift resolver derives the file path, so the two
 * halves of a locator can never disagree about where the boundary is.
 */
export function fragmentOf(uri: string): string | undefined {
  const hash = uri.indexOf("#");
  if (hash === -1) return undefined;
  const fragment = uri.slice(hash + 1);
  return fragment === "" ? undefined : fragment;
}

/**
 * Media types whose fragments have exact, defined semantics. Extension-based on
 * purpose: it is the same signal the author used when they wrote the locator,
 * and it never guesses from content. `.jsonc` and `.json5` are excluded because
 * `JSON.parse` cannot read them, so they fail closed rather than half-work.
 */
export function fragmentMediaType(filePath: string): "json" | undefined {
  return extname(filePath).toLowerCase() === ".json" ? "json" : undefined;
}

/**
 * Decode a fragment into the member path it names.
 *
 * Two forms are accepted. A leading `/` marks an RFC 6901 JSON Pointer
 * (`#/scripts/build`), where `~1` is a literal `/` and `~0` a literal `~`.
 * Anything else is one top-level member name taken literally — the common
 * `package.json#bin` form, and the reason a member called `@scope/name` needs
 * no escaping.
 *
 * Percent-decoding is deliberately not performed. RQML locators are written by
 * hand, and giving the same bytes two possible readings is exactly how a
 * fragment resolver ends up hashing the wrong span.
 */
export function parseFragmentPointer(fragment: string): string[] {
  if (!fragment.startsWith("/")) return [fragment];
  return fragment
    .slice(1)
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
}

/**
 * Read the raw JSON string token starting at `start` (an opening quote),
 * returning its end index (exclusive), or -1 if it is unterminated.
 */
function endOfString(text: string, start: number): number {
  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === '"') return i + 1;
  }
  return -1;
}

/**
 * True when any object in the document declares the same member twice.
 *
 * `JSON.parse` silently keeps the last of a duplicated key, so the parsed value
 * would be a faithful hash of only part of the file's claim about that member.
 * Rather than narrow on a reading the file does not uniquely support, treat the
 * whole document as ambiguous and let the whole-file alarm stand. Malformed
 * input also reports true: it is another way of not being sure, and `JSON.parse`
 * would reject it moments later anyway.
 *
 * Keys are compared after decoding, because `"a"` and `"a"` are the same
 * member and the parser would collapse them.
 */
export function hasDuplicateKeys(text: string): boolean {
  // One entry per open container: a Set of seen keys for an object, null for an
  // array (whose elements are never keys).
  const stack: (Set<string> | null)[] = [];

  for (let i = 0; i < text.length; ) {
    const ch = text[i];
    if (ch === "{") {
      stack.push(new Set());
      i++;
      continue;
    }
    if (ch === "[") {
      stack.push(null);
      i++;
      continue;
    }
    if (ch === "}" || ch === "]") {
      stack.pop();
      i++;
      continue;
    }
    if (ch !== '"') {
      i++;
      continue;
    }

    const end = endOfString(text, i);
    if (end === -1) return true; // unterminated string: not readable
    const raw = text.slice(i, end);
    i = end;

    const container = stack[stack.length - 1];
    if (!(container instanceof Set)) continue; // a string inside an array

    // A key is a string followed by ':'; anything else is a member value.
    let j = i;
    while (j < text.length && /\s/.test(text[j] as string)) j++;
    if (text[j] !== ":") continue;
    i = j + 1;

    let key: string;
    try {
      key = JSON.parse(raw) as string;
    } catch {
      return true; // an unreadable key is an unreadable document
    }
    if (container.has(key)) return true;
    container.add(key);
  }
  return false;
}

/** Walk a decoded member path through a parsed JSON value. */
function walk(root: unknown, segments: string[]): FragmentResolution {
  let current: unknown = root;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      // RFC 6901 indexes are canonical decimals; `-` (past the end) resolves to
      // nothing, so it is a failure here rather than a special case.
      if (!/^(?:0|[1-9][0-9]*)$/.test(segment)) {
        return fail(`"${segment}" is not an array index`);
      }
      const index = Number(segment);
      if (index >= current.length) return fail(`index ${index} is past the end`);
      current = current[index];
      continue;
    }
    if (typeof current === "object" && current !== null) {
      if (!Object.hasOwn(current, segment)) return fail(`no member "${segment}"`);
      current = (current as Record<string, unknown>)[segment];
      continue;
    }
    const kind = current === null ? "null" : typeof current;
    return fail(`"${segment}" cannot be resolved inside a ${kind}`);
  }
  return { ok: true, value: current };
}

/** Resolve a fragment against JSON source text. */
export function resolveJsonFragment(text: string, fragment: string): FragmentResolution {
  if (hasDuplicateKeys(text)) {
    return fail("the document declares a member twice, so the fragment is ambiguous");
  }
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return fail("the document is not valid JSON");
  }
  return walk(root, parseFragmentPointer(fragment));
}

/**
 * Serialize a JSON value canonically: object members in code-unit order of
 * their keys, arrays in their own order.
 *
 * Hashing the canonical form rather than the source bytes means re-indenting a
 * manifest or reordering its members is not evidence of change — which is
 * sound precisely because the parse is exact, and is the reason this asymmetry
 * is confined to JSON.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const body = entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
  return `{${body.join(",")}}`;
}

/**
 * Hash the content a locator's fragment names, or explain why it cannot be
 * narrowed. Callers treat any failure as "keep the whole-file verdict".
 */
export function fragmentHashAt(filePath: string, fragment: string): FragmentHash {
  if (fragmentMediaType(filePath) !== "json") {
    return fail(`${extname(filePath) || "this file type"} fragments are not interpreted`);
  }
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    return fail("the file could not be read");
  }
  const resolved = resolveJsonFragment(text, fragment);
  if (!resolved.ok) return resolved;
  return {
    ok: true,
    hash: createHash("sha256").update(canonicalJson(resolved.value)).digest("hex"),
  };
}

/**
 * The fragment hash for a locator, or `undefined` when the locator names no
 * fragment or the fragment cannot be resolved exactly. The two cases are
 * deliberately indistinguishable to the drift resolver: both mean "no narrowed
 * evidence is available", and both leave the whole-file verdict in place.
 */
export function fragmentHashForUri(uri: string, filePath: string): string | undefined {
  const fragment = fragmentOf(uri);
  if (fragment === undefined) return undefined;
  const hashed = fragmentHashAt(filePath, fragment);
  return hashed.ok ? hashed.hash : undefined;
}
