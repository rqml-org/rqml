import { existsSync, statSync } from "node:fs";
import { discoverSpecs } from "@rqml/core";
import { type Args, EXIT, UsageError, flagString } from "./runtime.js";

/**
 * Workspace fan-out: run a single-spec command across every unit spec a
 * repository holds, with one aggregated exit code (REQ-WORKSPACE-FANOUT,
 * ADR-0012). Discovery is `@rqml/core`'s nearest-wins enumeration
 * (REQ-CORE-SPEC-DISCOVERY); each unit is run against its own directory so its
 * code links and drift baseline resolve per-unit.
 */

/** The per-unit outcome a fan-out command returns (no I/O — the runner prints). */
export interface SpecRunResult {
  code: number;
  /** Machine-readable result, embedded under the unit in `--json` output. */
  json: unknown;
  /** Human-readable block, printed verbatim per unit in non-JSON output. */
  human: string;
}

export type SpecRunner = (
  specPath: string,
  perArgs: Args,
) => Promise<SpecRunResult> | SpecRunResult;

export interface WorkspaceOptions {
  /** Whether an ambiguous spec directory fails the run (gates: yes; status: no). */
  ambiguityBlocks?: boolean;
}

/** Comma-separated `--ignore` base names → a directory-skip predicate for discovery. */
function ignorePredicate(
  args: Args,
): ((name: string, fullPath: string) => boolean) | undefined {
  const list = flagString(args, "ignore");
  if (list === undefined) return undefined;
  const names = new Set(
    list
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return (name) => names.has(name);
}

function aggregateCode(codes: number[], blockingAmbiguity: number): number {
  if (codes.includes(EXIT.VALIDATION)) return EXIT.VALIDATION;
  if (blockingAmbiguity > 0 || codes.includes(EXIT.CHECK)) return EXIT.CHECK;
  return EXIT.OK;
}

export async function runWorkspace(
  label: string,
  args: Args,
  runOne: SpecRunner,
  options: WorkspaceOptions = {},
): Promise<number> {
  const root = args.baseDir;
  // A typo'd or missing root would otherwise discover zero specs and pass as a
  // false "green"; fail loudly instead (UsageError → exit 64).
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new UsageError(`workspace root is not a directory: ${root}`);
  }
  const ignore = ignorePredicate(args);
  const { specs, ambiguous } = discoverSpecs(root, ignore ? { ignore } : {});

  const units: { path: string; result: SpecRunResult }[] = [];
  for (const spec of specs) {
    const perArgs: Args = { ...args, positionals: [spec.specPath], baseDir: spec.dir };
    // Isolate each unit: a read/parse failure on one spec becomes that unit's
    // failing verdict, never an abort that discards every other unit's result.
    try {
      units.push({ path: spec.specPath, result: await runOne(spec.specPath, perArgs) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      units.push({
        path: spec.specPath,
        result: {
          code: EXIT.VALIDATION,
          json: { path: spec.specPath, error: message },
          human: `✗ ${spec.specPath}: ${message}\n`,
        },
      });
    }
  }

  const ambiguityBlocks = options.ambiguityBlocks ?? true;
  const code = aggregateCode(
    units.map((u) => u.result.code),
    ambiguityBlocks ? ambiguous.length : 0,
  );
  const failing = units.filter((u) => u.result.code !== EXIT.OK).map((u) => u.path);

  if (args.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          command: label,
          root,
          verdict: code === EXIT.OK ? "pass" : "fail",
          exitCode: code,
          units: units.map((u) => ({
            path: u.path,
            code: u.result.code,
            result: u.result.json,
          })),
          ambiguous,
        },
        null,
        2,
      )}\n`,
    );
  } else {
    for (const u of units) {
      const block = u.result.human;
      if (block.length > 0)
        process.stdout.write(block.endsWith("\n") ? block : `${block}\n`);
    }
    for (const a of ambiguous) {
      process.stderr.write(
        `${ambiguityBlocks ? "✗" : "•"} ambiguous spec directory: ${a.dir} (${a.candidates.join(", ")})\n`,
      );
    }
    const mark = code === EXIT.OK ? "✓" : "✗";
    process.stdout.write(
      `${mark} workspace ${label}: ${specs.length} spec(s)` +
        `${failing.length > 0 ? `, ${failing.length} failing` : ""}` +
        `${ambiguous.length > 0 ? `, ${ambiguous.length} ambiguous` : ""}\n`,
    );
    for (const f of failing) process.stderr.write(`  failing: ${f}\n`);
  }
  return code;
}
