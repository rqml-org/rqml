import { readFileSync } from "node:fs";
import { computeCoverage, lint, parse, resolveTrace } from "@rqml/core";
import { type Args, EXIT, isWorkspace, parseArgs, resolveSpecPath } from "../runtime.js";
import { type SpecRunResult, runWorkspace } from "../workspace.js";

/** Summarize one already-resolved spec, returning its result without printing. */
function statusOne(path: string, _args: Args): SpecRunResult {
  const xml = readFileSync(path, "utf8");
  const parsed = parse(xml);
  if (!parsed.ok) {
    return {
      code: EXIT.VALIDATION,
      json: { path, error: parsed.error.message },
      human: `✗ ${path}: ${parsed.error.message}\n`,
    };
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

  const human =
    `RQML status — ${doc.docId} (${doc.version}, ${doc.status})\n` +
    `  spec: ${path}\n` +
    `  requirements: ${reqCount}   trace edges: ${doc.trace.length}\n` +
    `  uncovered goals: ${coverage.uncoveredGoals.length}\n` +
    `  unverified reqs: ${coverage.unverifiedRequirements.length}\n` +
    `  unimplemented reqs: ${coverage.unimplementedRequirements.length}` +
    ` (approved: ${coverage.unimplementedApprovedRequirements.length})\n` +
    `  premature implementations: ${coverage.prematureImplementations.length}\n` +
    `  dangling refs: ${trace.diagnostics.length}   lint findings: ${lintDiags.length}\n`;

  return { code: EXIT.OK, json: summary, human };
}

/**
 * `rqml status` — current spec, coverage, and lint state (informational).
 * `--workspace` / `--all` summarizes every unit spec beneath the base directory;
 * ambiguous directories are noted but do not fail an informational command.
 */
export async function runStatus(rest: string[]): Promise<number> {
  const args = parseArgs(rest);
  if (isWorkspace(args)) {
    return runWorkspace("status", args, statusOne, { ambiguityBlocks: false });
  }
  const result = statusOne(resolveSpecPath(args), args);
  process.stdout.write(
    args.json ? `${JSON.stringify(result.json, null, 2)}\n` : result.human,
  );
  return result.code;
}
