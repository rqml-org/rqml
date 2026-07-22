import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Diagnostic, DiagnosticSeverity } from "../model/diagnostic.js";
import type { RqmlDocument } from "../model/types.js";
import { declaredIdIndex } from "../trace/index.js";

/**
 * ADR reference integrity (REQ-CORE-ADR-REFS).
 *
 * Trace edges are checked for referential integrity, but an ADR's citations
 * are prose: rename or retire a requirement and every record arguing about it
 * silently becomes a lie — the rationale survives, its subject does not.
 *
 * The rule is deliberately narrow, because an audit of the ecosystem found two
 * real dangling references against twenty-eight correct citations. Everything
 * this does NOT inspect is a class that produced only false positives:
 *
 *   - Superseded/rejected records. Their references to retired ids are
 *     accurate history; "fixing" them would falsify the record.
 *   - Body prose. It carries historical citations ("from the former
 *     core.rqml (`REQ-SERIALIZE`)") and cross-repo mentions.
 *   - Fenced and inline examples (`from="REQ-A" to="GOAL-B"`), which are
 *     syntax illustrations, not references.
 *
 * What remains — the Decision ID and Related requirements header fields — is
 * structured, so it is parsed exactly rather than guessed at.
 */

/** Header fields whose value is a list of spec identifiers. */
const HEADER_FIELD =
  /^\s*[-*]\s*\*{0,2}(?:Related\s+requirements?|Decision\s+IDs?)\*{0,2}[^:]*:\s*(.+)$/i;

/** `- Status: Superseded by ADR-0008` / `- **Status**: Rejected` */
const STATUS_FIELD = /^\s*[-*]?\s*\*{0,2}Status\*{0,2}\s*:\s*(.+)$/i;
const RETIRED_STATUS = /supersed|reject/i;

/**
 * An identifier token: an upper-case segment followed by at least one
 * hyphen-joined segment (REQ-A, QGOAL-DIFF, SCN-AUTHOR). Matching the shape
 * rather than a fixed vocabulary keeps the rule project-agnostic — each
 * document's own declared prefixes decide what counts.
 */
const ID_TOKEN = /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9][A-Z0-9._]*)+\b/g;

/** One citation found in a header field. */
interface Citation {
  id: string;
  /** The author qualified this id with a parenthetical, e.g. `(rqml-claude)`. */
  qualified: boolean;
}

/**
 * Extract citations from a header field's value.
 *
 * Parentheses are the author's annotation channel, and both directions matter:
 * an id *inside* a parenthetical is commentary rather than a citation, and an
 * id *followed by* one has been explicitly qualified — the established
 * convention for "this lives in another document", as in
 * `REQ-HOOK-PREIMPL (rqml-claude, rqml-codex)`. Only unresolved ids consult
 * the qualifier, so it can never hide an id that would otherwise resolve.
 */
export function citationsInField(value: string): Citation[] {
  // Keep only top-level (unparenthesised) text, remembering where each kept
  // character sat in the original so a following "(" can still be seen.
  const kept: string[] = [];
  const origIndex: number[] = [];
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i] as string;
    if (ch === "(") {
      depth++;
      continue;
    }
    if (ch === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0) {
      kept.push(ch);
      origIndex.push(i);
    }
  }
  const topLevel = kept.join("");

  const citations: Citation[] = [];
  ID_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic global-regex exec loop
  while ((match = ID_TOKEN.exec(topLevel)) !== null) {
    const lastKept = origIndex[match.index + match[0].length - 1] ?? value.length - 1;
    const qualified = /^\s*\(/.test(value.slice(lastKept + 1));
    citations.push({ id: match[0], qualified });
  }
  return citations;
}

/** True when the record's own status marks it as no longer authoritative. */
export function isRetiredRecord(markdown: string): boolean {
  for (const line of markdown.split("\n")) {
    const status = STATUS_FIELD.exec(line);
    if (status) return RETIRED_STATUS.test(status[1] as string);
  }
  return false;
}

export interface AdrReferenceOptions {
  /** Directory holding the ADR files, typically `<spec dir>/.rqml/adr`. */
  adrDir: string;
  /** Severity for findings; defaults to "warning". */
  severity?: DiagnosticSeverity;
}

/** The three ways an unresolved citation can legitimately be settled. */
const REMEDY =
  'Repoint it at the current id, mark the record superseded if the decision no longer applies, or qualify it (e.g. "ID (other-repo)") if it belongs to another document.';

/** ADR files in deterministic order; `README.md` is an index, not a record. */
function adrFiles(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith(".md"))
    .filter((name) => name.toLowerCase() !== "readme.md")
    .sort();
}

/**
 * Report ADR header citations that name an identifier the document does not
 * declare. Deterministic for a given directory and document; returns an empty
 * list when the directory is absent, so a project without ADRs is silent
 * rather than penalised.
 */
export function lintAdrReferences(
  doc: RqmlDocument,
  options: AdrReferenceOptions,
): Diagnostic[] {
  const declared = declaredIdIndex(doc);
  // Only prefixes this document actually uses are treated as identifiers, so
  // external vocabularies (ADR-0008, RFC-2119, ISO-13485) are never candidates.
  const prefixes = new Set(
    [...declared.keys()].filter((id) => id.includes("-")).map((id) => id.split("-")[0]),
  );
  const severity = options.severity ?? "warning";
  const findings: Diagnostic[] = [];

  for (const name of adrFiles(options.adrDir)) {
    let markdown: string;
    try {
      markdown = readFileSync(join(options.adrDir, name), "utf8");
    } catch {
      continue; // unreadable file: not this rule's business
    }
    if (isRetiredRecord(markdown)) continue;

    const lines = markdown.split("\n");
    for (const [index, line] of lines.entries()) {
      const field = HEADER_FIELD.exec(line);
      if (field === null) continue;
      for (const { id, qualified } of citationsInField(field[1] as string)) {
        if (!prefixes.has(id.split("-")[0] as string)) continue;
        if (declared.has(id) || qualified) continue;
        findings.push({
          source: "lint",
          severity,
          rule: "unresolved-adr-reference",
          line: index + 1,
          message: `${name} references "${id}", which is not declared in the spec. ${REMEDY}`,
        });
      }
    }
  }
  return findings;
}
