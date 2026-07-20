import { writeFileSync } from "node:fs";
import {
  type LinkRequest,
  TRACE_TYPES,
  type TraceType,
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

const USAGE = `usage: rqml link <from> <to> [--type <traceType>] [--id <edge-id>] [--kind <k>] [--title <t>]
                 [--notes <why>] [--confidence <0-1>] [--tags <a,b>] [--by <who>] [--status <s>] [--spec <path>]
       rqml link <artifact-id> <uri> --update [--type implements|verifiedBy] [--id <edge-id>] [--kind <k>] [--title <t>] [--spec <path>]
       rqml link --refresh <edge-id> [--spec <path>]
       trace types: ${TRACE_TYPES.join(" ")}`;

/** A positional that can only be an external locator, never a declared id. */
function looksExternal(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) || value.includes("/");
}

/**
 * `rqml link` — record a trace edge of any type mechanically (REQ-LOOP-LINK)
 * and the drift baseline for the linked artifact where one applies
 * (REQ-CORE-DRIFT-BASELINE). Endpoints are declared artifact ids or external
 * URIs; implements/verifiedBy edges are auto-oriented, other types are
 * recorded exactly from → to. New edges are stamped status="draft" and
 * createdBy="rqml" unless overridden (--status, --by). With `--update` the
 * existing edge's external locator is replaced in place, and with
 * `--refresh <edge-id>` only the baseline entry is re-recorded
 * (REQ-LOOP-RELINK). The spec file is only written when the edited document
 * still validates.
 */
export async function runLink(rest: string[]): Promise<number> {
  const args = parseArgs(rest);
  if (args.flags.has("refresh")) {
    const edgeId = flagString(args, "refresh");
    if (edgeId === undefined) throw new UsageError(USAGE);
    return runRefresh(args, edgeId);
  }

  const [first, second] = args.positionals;
  if (first === undefined || second === undefined) throw new UsageError(USAGE);
  const type = flagString(args, "type") ?? "implements";
  if (!(TRACE_TYPES as readonly string[]).includes(type)) {
    throw new UsageError(`unknown link type "${type}" (${TRACE_TYPES.join("|")})`);
  }
  const update = args.flags.get("update") === true || args.flags.get("update") === "true";
  const { path, xml } = readSpec(specArgs(args));

  if (update) {
    if (type !== "implements" && type !== "verifiedBy") {
      throw new UsageError("--update maintains implements/verifiedBy edges only");
    }
    // Legacy order is <artifact-id> <uri>; accept either order when it is
    // unambiguous which positional is the URI.
    const [artifactId, uri] =
      looksExternal(first) && !looksExternal(second) ? [second, first] : [first, second];
    return runUpdate(args, path, xml, { artifactId, uri, type });
  }

  const request: LinkRequest = { from: first, to: second, type: type as TraceType };
  const edgeId = flagString(args, "id");
  if (edgeId !== undefined) request.edgeId = edgeId;
  const kind = flagString(args, "kind");
  if (kind !== undefined) request.kind = kind;
  const title = flagString(args, "title");
  if (title !== undefined) request.title = title;
  const notes = flagString(args, "notes");
  if (notes !== undefined) request.notes = notes;
  const confidence = flagString(args, "confidence");
  if (confidence !== undefined) {
    const value = Number(confidence);
    if (!Number.isFinite(value)) {
      throw new UsageError(
        `--confidence must be a number between 0 and 1, got "${confidence}"`,
      );
    }
    request.confidence = value;
  }
  const tags = flagString(args, "tags");
  if (tags !== undefined) {
    request.tags = tags.split(/[\s,]+/).filter((t) => t !== "");
  }
  const status = flagString(args, "status");
  if (status !== undefined) request.status = status as LinkRequest["status"];
  const createdBy = flagString(args, "by");
  if (createdBy !== undefined) request.createdBy = createdBy;

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

  const baselineRecorded = recordBaseline(args, result.xml, result.edgeId);
  const statusValue = request.status ?? "draft";

  if (args.json) {
    const report = {
      spec: path,
      mode: "append",
      edgeId: result.edgeId,
      type,
      from: result.from,
      to: result.to,
      status: statusValue,
      createdBy: request.createdBy ?? "rqml",
      baselineRecorded,
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    const baseline = baselineRecorded ? ", baseline recorded" : "";
    process.stdout.write(
      `✓ ${result.from} —${type}→ ${result.to} (${result.edgeId}, ${statusValue}${baseline})\n`,
    );
  }
  return EXIT.OK;
}

/** Hash the newly linked artifact only — re-hashing every link here would
 * silently bless drifted artifacts. */
function recordBaseline(args: Args, xml: string, edgeId: string): boolean {
  const parsed = parse(xml);
  if (!parsed.ok) return false;
  const fresh = computeBaseline(parsed.document, { baseDir: args.baseDir });
  const hash = fresh[edgeId];
  if (hash === undefined) return false;
  const baseline = loadBaseline(args.baseDir) ?? {};
  baseline[edgeId] = hash;
  saveBaseline(args.baseDir, baseline);
  return true;
}

async function runUpdate(
  args: Args,
  path: string,
  xml: string,
  base: { artifactId: string; uri: string; type: "implements" | "verifiedBy" },
): Promise<number> {
  const request = { ...base } as Parameters<typeof updateTraceEdge>[1];
  const edgeId = flagString(args, "id");
  if (edgeId !== undefined) request.edgeId = edgeId;
  const kind = flagString(args, "kind");
  if (kind !== undefined) request.kind = kind;
  const title = flagString(args, "title");
  if (title !== undefined) request.title = title;

  const result = updateTraceEdge(xml, request);
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
  const baselineRecorded = recordBaseline(args, result.xml, result.edgeId);

  if (args.json) {
    const report = {
      spec: path,
      mode: "update",
      edgeId: result.edgeId,
      type: base.type,
      artifactId: base.artifactId,
      uri: base.uri,
      previousUri: result.previousUri,
      baselineRecorded,
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    const arrow = base.type === "implements" ? "←" : "→";
    const baseline = baselineRecorded ? ", baseline recorded" : "";
    process.stdout.write(
      `✓ ${base.artifactId} ${arrow} ${base.uri} (${result.edgeId}, ${base.type}, updated${baseline})\n`,
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
