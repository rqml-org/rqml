import { extractArtifact, parse, sliceToMarkdown } from "@rqml/core";
import { EXIT, UsageError, parseArgs, readSpec, specArgs } from "../runtime.js";

/**
 * `rqml show` — extract one artifact with its statement, acceptance criteria,
 * and trace neighborhood (REQ-LOOP-SHOW), so an agent reads a slice of the
 * spec instead of the whole document.
 */
export async function runShow(rest: string[]): Promise<number> {
  const args = parseArgs(rest);
  const id = args.positionals[0];
  if (id === undefined) {
    throw new UsageError("usage: rqml show <id> [--json] [--spec <path>]");
  }
  const { path, xml } = readSpec(specArgs(args));
  const parsed = parse(xml);
  if (!parsed.ok) {
    process.stderr.write(`✗ ${path}: ${parsed.error.message}\n`);
    return EXIT.VALIDATION;
  }
  const slice = extractArtifact(parsed.document, id);
  if (slice === undefined) {
    process.stderr.write(`✗ no artifact with id "${id}" in ${path}\n`);
    return EXIT.USAGE;
  }
  process.stdout.write(
    args.json ? `${JSON.stringify(slice, null, 2)}\n` : sliceToMarkdown(slice),
  );
  return EXIT.OK;
}
