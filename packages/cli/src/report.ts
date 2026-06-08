import type { Diagnostic } from "@rqml/core";

/** Render a normalized diagnostic as a single human-readable line. */
export function formatDiagnostic(d: Diagnostic): string {
  const loc =
    d.line !== undefined
      ? `:${d.line}${d.column !== undefined ? `:${d.column}` : ""}`
      : "";
  const rule = d.rule !== undefined ? ` [${d.rule}]` : "";
  return `  ${d.severity}${loc} (${d.source})${rule}: ${d.message}`;
}

export function printDiagnostics(diags: Diagnostic[]): void {
  for (const d of diags) process.stdout.write(`${formatDiagnostic(d)}\n`);
}
