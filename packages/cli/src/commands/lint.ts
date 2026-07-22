import { readFileSync } from "node:fs";
import { type Strictness as LintStrictness, lint, parse } from "@rqml/core";
import { formatDiagnostic } from "../report.js";
import { EXIT, adrDirFor, parseArgs, resolveSpecPath } from "../runtime.js";

/** Map the CLI's strictness vocabulary to @rqml/core's lint strictness ladder. */
const LINT_STRICTNESS: Record<string, LintStrictness> = {
  relaxed: "lenient",
  standard: "standard",
  strict: "strict",
  certified: "strict",
};

/**
 * `rqml lint` — run @rqml/core's semantic lint over the resolved spec and report
 * the findings (REQ-CLI-LINT). Severities scale with --strictness, and the
 * command exits non-zero when any finding is an error, so `rqml lint
 * --strictness strict` is a usable document-quality gate for CI.
 */
export async function runLint(rest: string[]): Promise<number> {
  const args = parseArgs(rest);
  const path = resolveSpecPath(args);
  const parsed = parse(readFileSync(path, "utf8"));
  if (!parsed.ok) {
    process.stderr.write(`✗ ${path}: ${parsed.error.message}\n`);
    return EXIT.VALIDATION;
  }

  const strictness = LINT_STRICTNESS[args.strictness] ?? "standard";
  const findings = lint(parsed.document, { strictness, adrDir: adrDirFor(path) });
  const hasError = findings.some((d) => d.severity === "error");

  if (args.json) {
    process.stdout.write(`${JSON.stringify({ path, strictness, findings }, null, 2)}\n`);
  } else {
    const summary =
      findings.length === 0
        ? `✓ ${path}: no lint findings (${strictness})`
        : `${hasError ? "✗" : "•"} ${path}: ${findings.length} lint finding(s) (${strictness})`;
    process.stdout.write(`${[...findings.map(formatDiagnostic), summary].join("\n")}\n`);
  }
  return hasError ? EXIT.VALIDATION : EXIT.OK;
}
