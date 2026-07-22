import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  checkIntegrity,
  computeCoverage,
  detectDrift,
  loadBaseline,
  parse,
} from "@rqml/core";
import { formatDiagnostic } from "../report.js";
import {
  type Args,
  EXIT,
  type Strictness,
  isWorkspace,
  parseArgs,
  resolveSpecPath,
} from "../runtime.js";
import { type SpecRunResult, runWorkspace } from "../workspace.js";

/** Coverage findings block the gate at strict and certified levels. */
function coverageBlocks(strictness: Strictness): boolean {
  return strictness === "strict" || strictness === "certified";
}

/**
 * A file that changed around an unchanged fragment is not implementation drift,
 * so it is advisory everywhere except certified — where the evidence is the
 * whole file an auditor would read, not just the span the locator names
 * (REQ-CORE-DRIFT-SCOPE).
 */
function contextChangeBlocks(strictness: Strictness): boolean {
  return strictness === "certified";
}

/**
 * Run the gate against one already-resolved spec, returning its verdict, JSON
 * report, and human block without writing to stdout (so the workspace runner
 * can aggregate). `args.baseDir` is the spec's own directory, so code links and
 * the drift baseline resolve per-unit.
 */
async function checkOne(path: string, args: Args): Promise<SpecRunResult> {
  const xml = readFileSync(path, "utf8");

  const { validate } = await import("@rqml/core/validate");
  const validation = validate(xml);
  const integrity = validation.valid ? checkIntegrity(xml) : [];

  const parsed = parse(xml);
  const coverage = parsed.ok ? computeCoverage(parsed.document) : undefined;
  const driftOptions: Parameters<typeof detectDrift>[1] = { baseDir: args.baseDir };
  const baseline = loadBaseline(args.baseDir);
  if (baseline !== undefined) driftOptions.baseline = baseline;
  const drift = parsed.ok ? detectDrift(parsed.document, driftOptions) : undefined;

  const validationFailed = !validation.valid || integrity.length > 0;
  const driftFailed =
    (drift?.drifted.length ?? 0) > 0 ||
    (contextChangeBlocks(args.strictness) && (drift?.contextChanged.length ?? 0) > 0);
  const coverageProblemCount =
    (coverage?.uncoveredGoals.length ?? 0) +
    (coverage?.unverifiedRequirements.length ?? 0) +
    (coverage?.orphanRequirements.length ?? 0) +
    (coverage?.unimplementedApprovedRequirements.length ?? 0) +
    (coverage?.prematureImplementations.length ?? 0);
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
    contextChanged: drift?.contextChanged ?? [],
    coverage: coverage
      ? {
          uncoveredGoals: coverage.uncoveredGoals,
          unverifiedRequirements: coverage.unverifiedRequirements,
          unimplementedRequirements: coverage.unimplementedRequirements,
          unimplementedApprovedRequirements: coverage.unimplementedApprovedRequirements,
          prematureImplementations: coverage.prematureImplementations,
          orphanRequirements: coverage.orphanRequirements,
        }
      : null,
    diagnostics,
  };

  const verdictLine = `${verdict === "pass" ? "✓" : "✗"} check ${verdict} (${args.strictness}) — ${path}`;
  const human = `${[...diagnostics.map(formatDiagnostic), verdictLine].join("\n")}\n`;

  const code = validationFailed
    ? EXIT.VALIDATION
    : driftFailed || coverageFailed
      ? EXIT.CHECK
      : EXIT.OK;

  return { code, json: report, human };
}

/**
 * `rqml check` — the deterministic enforcement gate. Composes XSD + integrity
 * validation, trace coverage, and implementation drift into a single verdict and
 * a stable exit code (REQ-CLI-CHECK-GATE, REQ-ENFORCE-DETERMINISM). It invokes no
 * language model, so identical inputs yield identical verdicts. `--workspace` /
 * `--all` runs the gate across every unit spec beneath the base directory and
 * returns one aggregated exit code (REQ-WORKSPACE-FANOUT).
 */
export async function runCheck(rest: string[]): Promise<number> {
  const args = parseArgs(rest);
  if (isWorkspace(args)) return runWorkspace("check", args, checkOne);

  const path = resolveSpecPath(args);
  // Code links and the drift baseline resolve against the spec's own directory
  // (the unit root) — matching the MCP surface and per-unit workspace runs — even
  // when --base-dir only started the upward walk from a subdirectory.
  const scoped: Args = { ...args, baseDir: dirname(path) };
  const result = await checkOne(path, scoped);
  process.stdout.write(
    args.json ? `${JSON.stringify(result.json, null, 2)}\n` : result.human,
  );
  return result.code;
}
