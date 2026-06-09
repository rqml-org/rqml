import { declaredIdIndex, impactOf, parse } from "@rqml/core";
import { EXIT, UsageError, parseArgs, readSpec, specArgs } from "../runtime.js";

/**
 * `rqml impact` — what is affected if this artifact changes? Transitive,
 * bidirectional trace-graph traversal (REQ-LOOP-IMPACT, SCN-IMPACT).
 */
export async function runImpact(rest: string[]): Promise<number> {
  const args = parseArgs(rest);
  const id = args.positionals[0];
  if (id === undefined) {
    throw new UsageError("usage: rqml impact <id> [--json] [--spec <path>]");
  }
  const { path, xml } = readSpec(specArgs(args));
  const parsed = parse(xml);
  if (!parsed.ok) {
    process.stderr.write(`✗ ${path}: ${parsed.error.message}\n`);
    return EXIT.VALIDATION;
  }
  if (!declaredIdIndex(parsed.document).has(id)) {
    process.stderr.write(`✗ no artifact with id "${id}" in ${path}\n`);
    return EXIT.USAGE;
  }

  const report = impactOf(parsed.document, id);
  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return EXIT.OK;
  }

  process.stdout.write(`Impact of ${id} — ${report.affected.length} affected\n`);
  for (const group of report.groups) {
    const arrow = group.direction === "outgoing" ? "→" : "←";
    process.stdout.write(`  ${arrow} ${group.type}: ${group.ids.join(", ")}\n`);
  }
  const transitive = report.affected.filter((a) => a.distance > 1);
  if (transitive.length > 0) {
    process.stdout.write("  transitively:\n");
    for (const a of transitive) {
      const path = a.path.map((s) => s.edgeId).join(" › ");
      process.stdout.write(
        `    ${a.id} (${a.kind}, distance ${a.distance} via ${path})\n`,
      );
    }
  }
  return EXIT.OK;
}
