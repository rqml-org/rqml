import { checkIntegrity, computeCoverage, detectDrift, parse } from "@rqml/core";
import { printDiagnostics } from "../report.js";
import { EXIT, parseArgs, readSpec, type Strictness } from "../runtime.js";

/** Coverage findings block the gate at strict and certified levels. */
function coverageBlocks(strictness: Strictness): boolean {
  return strictness === "strict" || strictness === "certified";
}

/**
 * `rqml check` — the deterministic enforcement gate. Composes XSD + integrity
 * validation, trace coverage, and implementation drift into a single verdict and
 * a stable exit code (REQ-CLI-CHECK-GATE, REQ-ENFORCE-DETERMINISM). It invokes no
 * language model, so identical inputs yield identical verdicts.
 */
export async function runCheck(rest: string[]): Promise<number> {
  const args = parseArgs(rest);
  const { path, xml } = readSpec(args);

  const { validate } = await import("@rqml/core/validate");
  const validation = validate(xml);
  const integrity = validation.valid ? checkIntegrity(xml) : [];

  const parsed = parse(xml);
  const coverage = parsed.ok ? computeCoverage(parsed.document) : undefined;
  const drift = parsed.ok ? detectDrift(parsed.document, { baseDir: args.baseDir }) : undefined;

  const validationFailed = !validation.valid || integrity.length > 0;
  const driftFailed = (drift?.drifted.length ?? 0) > 0;
  const coverageProblemCount =
    (coverage?.uncoveredGoals.length ?? 0) +
    (coverage?.unverifiedRequirements.length ?? 0) +
    (coverage?.orphanRequirements.length ?? 0);
  const coverageFailed = coverageBlocks(args.strictness) && coverageProblemCount > 0;

  const verdict: "pass" | "fail" =
    validationFailed || driftFailed || coverageFailed ? "fail" : "pass";

  const diagnostics = [
    ...validation.diagnostics,
    ...integrity,
    ...(drift?.diagnostics ?? []),
    ...(coverageFailed ? (coverage?.diagnostics ?? []) : []),
  ];

  const report = {
    path,
    verdict,
    strictness: args.strictness,
    schemaVersion: validation.schemaVersion,
    valid: !validationFailed,
    drift: drift?.drifted ?? [],
    coverage: coverage
      ? {
          uncoveredGoals: coverage.uncoveredGoals,
          unverifiedRequirements: coverage.unverifiedRequirements,
          unimplementedRequirements: coverage.unimplementedRequirements,
          orphanRequirements: coverage.orphanRequirements,
        }
      : null,
    diagnostics,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    if (diagnostics.length > 0) printDiagnostics(diagnostics);
    process.stdout.write(
      `${verdict === "pass" ? "✓" : "✗"} check ${verdict} (${args.strictness}) — ${path}\n`,
    );
  }

  if (validationFailed) return EXIT.VALIDATION;
  if (driftFailed || coverageFailed) return EXIT.CHECK;
  return EXIT.OK;
}
