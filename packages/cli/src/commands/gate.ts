import { approvalGate, parse } from "@rqml/core";
import { EXIT, flagString, parseArgs, readSpec, specArgs } from "../runtime.js";

/**
 * `rqml gate [paths...]` — the approval-before-implementation primitive
 * (REQ-ENFORCE-APPROVAL-GATE): exits non-zero when implementation is linked to a
 * requirement that is not approved, so editor/agent hooks and CI can block it.
 * Optional changed paths (positionals or `--changed`) scope the verdict to the
 * edit at hand. No language model in the verdict path (REQ-CORE-NO-LLM).
 */
function list(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  const items = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export async function runGate(rest: string[]): Promise<number> {
  const args = parseArgs(rest);
  const { path, xml } = readSpec(specArgs(args));
  const parsed = parse(xml);
  if (!parsed.ok) {
    process.stderr.write(`✗ ${path}: ${parsed.error.message}\n`);
    return EXIT.VALIDATION;
  }
  const changed =
    list(flagString(args, "changed")) ??
    (args.positionals.length > 0 ? args.positionals : undefined);
  const verdict = approvalGate(parsed.document, changed ? { changedPaths: changed } : {});

  if (args.json) {
    process.stdout.write(`${JSON.stringify(verdict, null, 2)}\n`);
  } else if (verdict.findings.length === 0) {
    process.stdout.write("✓ no implementation linked to a non-approved requirement\n");
  } else {
    for (const f of verdict.findings) {
      process.stdout.write(
        `✗ ${f.uri ?? f.edgeId} implements ${f.requirementId}, which is not approved\n`,
      );
    }
  }
  return verdict.blocked ? EXIT.CHECK : EXIT.OK;
}
