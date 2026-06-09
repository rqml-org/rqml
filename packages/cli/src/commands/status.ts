import { computeCoverage, lint, parse, resolveTrace } from "@rqml/core";
import { EXIT, parseArgs, readSpec } from "../runtime.js";

/** `rqml status` — current spec, coverage, and lint state (informational). */
export async function runStatus(rest: string[]): Promise<number> {
  const args = parseArgs(rest);
  const { path, xml } = readSpec(args);
  const parsed = parse(xml);
  if (!parsed.ok) {
    process.stderr.write(`✗ ${path}: ${parsed.error.message}\n`);
    return EXIT.VALIDATION;
  }
  const doc = parsed.document;
  const coverage = computeCoverage(doc);
  const lintDiags = lint(doc);
  const trace = resolveTrace(doc);
  const reqCount =
    doc.packages.reduce((n, p) => n + p.requirements.length, 0) +
    doc.looseRequirements.length;

  const summary = {
    path,
    docId: doc.docId,
    version: doc.version,
    status: doc.status,
    requirements: reqCount,
    edges: doc.trace.length,
    uncoveredGoals: coverage.uncoveredGoals,
    unverifiedRequirements: coverage.unverifiedRequirements,
    unimplementedRequirements: coverage.unimplementedRequirements,
    unimplementedApprovedRequirements: coverage.unimplementedApprovedRequirements,
    prematureImplementations: coverage.prematureImplementations,
    orphanRequirements: coverage.orphanRequirements,
    danglingReferences: trace.diagnostics.length,
    lintFindings: lintDiags.length,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    process.stdout.write(
      `RQML status — ${doc.docId} (${doc.version}, ${doc.status})\n` +
        `  spec: ${path}\n` +
        `  requirements: ${reqCount}   trace edges: ${doc.trace.length}\n` +
        `  uncovered goals: ${coverage.uncoveredGoals.length}\n` +
        `  unverified reqs: ${coverage.unverifiedRequirements.length}\n` +
        `  unimplemented reqs: ${coverage.unimplementedRequirements.length}` +
        ` (approved: ${coverage.unimplementedApprovedRequirements.length})\n` +
        `  premature implementations: ${coverage.prematureImplementations.length}\n` +
        `  dangling refs: ${trace.diagnostics.length}   lint findings: ${lintDiags.length}\n`,
    );
  }
  return EXIT.OK;
}
