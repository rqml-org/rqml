import { checkIntegrity } from "@rqml/core";
import { printDiagnostics } from "../report.js";
import { EXIT, parseArgs, readSpec } from "../runtime.js";

/** `rqml validate` — XML well-formedness, XSD validity, and referential integrity. */
export async function runValidate(rest: string[]): Promise<number> {
  const args = parseArgs(rest);
  const { path, xml } = readSpec(args);

  // Lazily load the XSD engine so its WASM cost is only paid when validating.
  const { validate } = await import("@rqml/core/validate");
  const result = validate(xml);
  const integrity = result.valid ? checkIntegrity(xml) : [];
  const diagnostics = [...result.diagnostics, ...integrity];
  const ok = result.valid && integrity.length === 0;

  if (args.json) {
    process.stdout.write(
      `${JSON.stringify({ path, valid: ok, schemaVersion: result.schemaVersion, diagnostics }, null, 2)}\n`,
    );
  } else {
    if (diagnostics.length > 0) printDiagnostics(diagnostics);
    process.stdout.write(
      ok
        ? `✓ ${path} is valid (schema ${result.schemaVersion})\n`
        : `✗ ${path}: ${diagnostics.length} problem(s)\n`,
    );
  }
  return ok ? EXIT.OK : EXIT.VALIDATION;
}
