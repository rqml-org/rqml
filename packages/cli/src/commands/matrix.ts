import { type MatrixFilter, buildMatrix, matrixToMarkdown, parse } from "@rqml/core";
import { EXIT, flagString, parseArgs, readSpec, specArgs } from "../runtime.js";

/**
 * `rqml matrix` — the traceability matrix (REQ-LOOP-MATRIX): one row per
 * requirement with status, upstream goals, implementing code, verifying tests,
 * and coverage warnings, as a markdown table or `--json`. Backed by
 * @rqml/core's buildMatrix, so it equals the rqml_matrix MCP tool
 * (REQ-MCP-PARITY). Optional `--status`/`--type`/`--warning` filter rows.
 */
function list(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  const items = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export async function runMatrix(rest: string[]): Promise<number> {
  const args = parseArgs(rest);
  const { path, xml } = readSpec(specArgs(args));
  const parsed = parse(xml);
  if (!parsed.ok) {
    process.stderr.write(`✗ ${path}: ${parsed.error.message}\n`);
    return EXIT.VALIDATION;
  }
  const status = list(flagString(args, "status"));
  const type = list(flagString(args, "type"));
  const warning = list(flagString(args, "warning"));
  const filter: MatrixFilter = {};
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (warning) filter.warning = warning;
  const filtered = status !== undefined || type !== undefined || warning !== undefined;

  const matrix = buildMatrix(parsed.document, filtered ? filter : undefined);
  process.stdout.write(
    args.json ? `${JSON.stringify(matrix, null, 2)}\n` : matrixToMarkdown(matrix),
  );
  return EXIT.OK;
}
