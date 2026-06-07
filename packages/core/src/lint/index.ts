import type { Diagnostic, DiagnosticSeverity } from "../model/diagnostic.js";
import { allRequirements, type RqmlDocument } from "../model/types.js";

/**
 * How aggressively lint rules report. Strictness scales a rule's severity
 * rather than toggling rules on and off, so the same finding surfaces as
 * advisory, a warning, or a hard error depending on the consumer's posture.
 */
export type Strictness = "lenient" | "standard" | "strict";

export interface LintOptions {
  /** Defaults to "standard". */
  strictness?: Strictness;
}

/**
 * Map a rule's nominal (standard) severity to the effective severity for a
 * strictness level. "lenient" relaxes one step (and drops infos), "strict"
 * escalates one step.
 */
function scaleSeverity(
  nominal: DiagnosticSeverity,
  strictness: Strictness,
): DiagnosticSeverity | undefined {
  const ladder: DiagnosticSeverity[] = ["info", "warning", "error"];
  const base = ladder.indexOf(nominal);
  const shift = strictness === "lenient" ? -1 : strictness === "strict" ? 1 : 0;
  const next = base + shift;
  if (next < 0) return undefined; // relaxed below info: suppressed
  return ladder[Math.min(next, ladder.length - 1)];
}

/** Requirements with no acceptance criteria are unverifiable. Nominal: warning. */
function missingAcceptance(
  doc: RqmlDocument,
  strictness: Strictness,
): Diagnostic[] {
  const severity = scaleSeverity("warning", strictness);
  if (severity === undefined) return [];
  return allRequirements(doc)
    .filter((req) => req.acceptance.length === 0)
    .map((req) => ({
      source: "lint",
      severity,
      rule: "missing-acceptance",
      message: `Requirement "${req.id}" has no acceptance criteria.`,
    }));
}

/** Run the semantic lint rules over a document. */
export function lint(doc: RqmlDocument, options?: LintOptions): Diagnostic[] {
  const strictness = options?.strictness ?? "standard";
  return [...missingAcceptance(doc, strictness)];
}
