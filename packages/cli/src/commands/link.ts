import { writeFileSync } from "node:fs";
import {
  type LinkRequest,
  appendTraceEdge,
  computeBaseline,
  loadBaseline,
  parse,
  saveBaseline,
} from "@rqml/core";
import { printDiagnostics } from "../report.js";
import {
  EXIT,
  UsageError,
  flagString,
  parseArgs,
  readSpec,
  specArgs,
} from "../runtime.js";

const USAGE =
  "usage: rqml link <artifact-id> <uri> [--type implements|verifiedBy] [--id <edge-id>] [--kind <k>] [--title <t>] [--spec <path>]";

/**
 * `rqml link` — record an implements/verifiedBy trace edge mechanically
 * (REQ-LOOP-LINK) and the drift baseline for the linked artifact
 * (REQ-CORE-DRIFT-BASELINE). The spec file is only written when the edited
 * document still validates.
 */
export async function runLink(rest: string[]): Promise<number> {
  const args = parseArgs(rest);
  const [artifactId, uri] = args.positionals;
  if (artifactId === undefined || uri === undefined) throw new UsageError(USAGE);
  const type = flagString(args, "type") ?? "implements";
  if (type !== "implements" && type !== "verifiedBy") {
    throw new UsageError(`unknown link type "${type}" (implements|verifiedBy)`);
  }

  const { path, xml } = readSpec(specArgs(args));
  const request: LinkRequest = { artifactId, uri, type };
  const edgeId = flagString(args, "id");
  if (edgeId !== undefined) request.edgeId = edgeId;
  const kind = flagString(args, "kind");
  if (kind !== undefined) request.kind = kind;
  const title = flagString(args, "title");
  if (title !== undefined) request.title = title;

  const result = appendTraceEdge(xml, request);
  if (!result.ok) {
    process.stderr.write(`✗ link failed: ${result.error}\n`);
    return EXIT.VALIDATION;
  }

  const { validate } = await import("@rqml/core/validate");
  const validation = validate(result.xml);
  if (!validation.valid) {
    printDiagnostics(validation.diagnostics);
    process.stderr.write("✗ link would invalidate the document; nothing written\n");
    return EXIT.VALIDATION;
  }
  writeFileSync(path, result.xml);

  // Hash the newly linked artifact only — re-hashing every link here would
  // silently bless drifted artifacts.
  let baselineRecorded = false;
  const parsed = parse(result.xml);
  if (parsed.ok) {
    const fresh = computeBaseline(parsed.document, { baseDir: args.baseDir });
    const hash = fresh[result.edgeId];
    if (hash !== undefined) {
      const baseline = loadBaseline(args.baseDir) ?? {};
      baseline[result.edgeId] = hash;
      saveBaseline(args.baseDir, baseline);
      baselineRecorded = true;
    }
  }

  if (args.json) {
    const report = {
      spec: path,
      edgeId: result.edgeId,
      type,
      artifactId,
      uri,
      baselineRecorded,
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    const arrow = type === "implements" ? "←" : "→";
    const baseline = baselineRecorded ? ", baseline recorded" : "";
    process.stdout.write(
      `✓ ${artifactId} ${arrow} ${uri} (${result.edgeId}, ${type}${baseline})\n`,
    );
  }
  return EXIT.OK;
}
