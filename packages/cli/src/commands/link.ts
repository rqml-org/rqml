import { writeFileSync } from "node:fs";
import {
  type LinkRequest,
  appendTraceEdge,
  computeBaseline,
  implementsLinks,
  loadBaseline,
  parse,
  saveBaseline,
  updateTraceEdge,
} from "@rqml/core";
import { printDiagnostics } from "../report.js";
import {
  type Args,
  EXIT,
  UsageError,
  flagString,
  parseArgs,
  readSpec,
  specArgs,
} from "../runtime.js";

const USAGE =
  "usage: rqml link <artifact-id> <uri> [--update] [--type implements|verifiedBy] [--id <edge-id>] [--kind <k>] [--title <t>] [--spec <path>]\n" +
  "       rqml link --refresh <edge-id> [--spec <path>]";

/**
 * `rqml link` — record an implements/verifiedBy trace edge mechanically
 * (REQ-LOOP-LINK) and the drift baseline for the linked artifact
 * (REQ-CORE-DRIFT-BASELINE). With `--update` the existing edge's external
 * locator is replaced in place, and with `--refresh <edge-id>` only the
 * baseline entry is re-recorded (REQ-LOOP-RELINK). The spec file is only
 * written when the edited document still validates.
 */
export async function runLink(rest: string[]): Promise<number> {
  const args = parseArgs(rest);
  if (args.flags.has("refresh")) {
    const edgeId = flagString(args, "refresh");
    if (edgeId === undefined) throw new UsageError(USAGE);
    return runRefresh(args, edgeId);
  }

  const [artifactId, uri] = args.positionals;
  if (artifactId === undefined || uri === undefined) throw new UsageError(USAGE);
  const type = flagString(args, "type") ?? "implements";
  if (type !== "implements" && type !== "verifiedBy") {
    throw new UsageError(`unknown link type "${type}" (implements|verifiedBy)`);
  }
  const update = args.flags.get("update") === true || args.flags.get("update") === "true";

  const { path, xml } = readSpec(specArgs(args));
  const request: LinkRequest = { artifactId, uri, type };
  const edgeId = flagString(args, "id");
  if (edgeId !== undefined) request.edgeId = edgeId;
  const kind = flagString(args, "kind");
  if (kind !== undefined) request.kind = kind;
  const title = flagString(args, "title");
  if (title !== undefined) request.title = title;

  const result = update ? updateTraceEdge(xml, request) : appendTraceEdge(xml, request);
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
      mode: update ? "update" : "append",
      edgeId: result.edgeId,
      type,
      artifactId,
      uri,
      baselineRecorded,
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    const arrow = type === "implements" ? "←" : "→";
    const mode = update ? ", updated" : "";
    const baseline = baselineRecorded ? ", baseline recorded" : "";
    process.stdout.write(
      `✓ ${artifactId} ${arrow} ${uri} (${result.edgeId}, ${type}${mode}${baseline})\n`,
    );
  }
  return EXIT.OK;
}

/**
 * `rqml link --refresh <edge-id>` — re-record the drift baseline for one
 * intentionally changed artifact (REQ-LOOP-RELINK). Edge-scoped on purpose:
 * the spec document is never touched, and no other entry is re-hashed.
 */
function runRefresh(args: Args, edgeId: string): number {
  const { path, xml } = readSpec(specArgs(args));
  const parsed = parse(xml);
  if (!parsed.ok) {
    process.stderr.write(`✗ refresh failed: ${parsed.error.message}\n`);
    return EXIT.VALIDATION;
  }
  const link = implementsLinks(parsed.document).find((l) => l.edgeId === edgeId);
  if (link === undefined) {
    process.stderr.write(
      `✗ refresh failed: no implements edge "${edgeId}" with an external locator exists (only implements edges carry baselines)\n`,
    );
    return EXIT.VALIDATION;
  }
  const hash = computeBaseline(parsed.document, { baseDir: args.baseDir })[edgeId];
  if (hash === undefined) {
    process.stderr.write(
      `✗ refresh failed: "${link.uri}" cannot be hashed (missing file or non-filesystem URI)\n`,
    );
    return EXIT.VALIDATION;
  }
  const baseline = loadBaseline(args.baseDir) ?? {};
  baseline[edgeId] = hash;
  saveBaseline(args.baseDir, baseline);

  if (args.json) {
    const report = { spec: path, mode: "refresh", edgeId, uri: link.uri, hash };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`✓ baseline refreshed for ${edgeId} (${link.uri})\n`);
  }
  return EXIT.OK;
}
