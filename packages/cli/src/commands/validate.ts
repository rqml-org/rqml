import { readFileSync } from "node:fs";
import { checkIntegrity } from "@rqml/core";
import { formatDiagnostic } from "../report.js";
import { type Args, EXIT, isWorkspace, parseArgs, resolveSpecPath } from "../runtime.js";
import { type SpecRunResult, runWorkspace } from "../workspace.js";

/** Validate one already-resolved spec, returning its result without printing. */
async function validateOne(path: string, _args: Args): Promise<SpecRunResult> {
  const xml = readFileSync(path, "utf8");
  // Lazily load the XSD engine so its WASM cost is only paid when validating.
  const { validate } = await import("@rqml/core/validate");
  const result = validate(xml);
  const integrity = result.valid ? checkIntegrity(xml) : [];
  const diagnostics = [...result.diagnostics, ...integrity];
  const ok = result.valid && integrity.length === 0;

  const verdictLine = ok
    ? `✓ ${path} is valid (schema ${result.schemaVersion})`
    : `✗ ${path}: ${diagnostics.length} problem(s)`;
  const human = `${[...diagnostics.map(formatDiagnostic), verdictLine].join("\n")}\n`;

  return {
    code: ok ? EXIT.OK : EXIT.VALIDATION,
    json: { path, valid: ok, schemaVersion: result.schemaVersion, diagnostics },
    human,
  };
}

/**
 * `rqml validate` — XML well-formedness, XSD validity, and referential integrity.
 * `--workspace` / `--all` validates every unit spec beneath the base directory.
 */
export async function runValidate(rest: string[]): Promise<number> {
  const args = parseArgs(rest);
  if (isWorkspace(args)) return runWorkspace("validate", args, validateOne);

  const result = await validateOne(resolveSpecPath(args), args);
  process.stdout.write(
    args.json ? `${JSON.stringify(result.json, null, 2)}\n` : result.human,
  );
  return result.code;
}
