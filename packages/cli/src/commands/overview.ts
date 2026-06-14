import {
  type ProjectionFilter,
  buildOutline,
  outlineToMarkdown,
  parse,
  projectOutline,
} from "@rqml/core";
import { EXIT, flagString, parseArgs, readSpec } from "../runtime.js";

/**
 * `rqml overview` — a readable projection of the spec (REQ-LOOP-OVERVIEW): the
 * whole document, or a subset scoped by `--section` (titles) and/or `--id`
 * (element ids), as markdown or `--json`. Backed by @rqml/core buildOutline +
 * projectOutline, so it equals the rqml_overview MCP tool (REQ-MCP-PARITY).
 */
function list(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  const items = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export async function runOverview(rest: string[]): Promise<number> {
  const args = parseArgs(rest);
  const { path, xml } = readSpec(args);
  const parsed = parse(xml);
  if (!parsed.ok) {
    process.stderr.write(`✗ ${path}: ${parsed.error.message}\n`);
    return EXIT.VALIDATION;
  }
  const filter: ProjectionFilter = {};
  const sections = list(flagString(args, "section"));
  const ids = list(flagString(args, "id"));
  if (sections) filter.sections = sections;
  if (ids) filter.ids = ids;

  const outline = projectOutline(buildOutline(parsed.document), filter);
  process.stdout.write(
    args.json ? `${JSON.stringify(outline, null, 2)}\n` : outlineToMarkdown(outline),
  );
  return EXIT.OK;
}
