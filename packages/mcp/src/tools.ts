import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  type LinkRequest,
  type MatrixFilter,
  SKELETON_KINDS,
  type SkeletonKind,
  appendTraceEdge,
  buildMatrix,
  checkIntegrity,
  computeBaseline,
  computeCoverage,
  declaredIdIndex,
  detectDrift,
  extractArtifact,
  impactOf,
  implementsLinks,
  loadBaseline,
  matrixToMarkdown,
  parse,
  resolveTrace,
  saveBaseline,
  skeleton,
  sliceToMarkdown,
  updateTraceEdge,
} from "@rqml/core";

/** Minimal JSON-schema tool descriptor (matches the MCP `Tool` shape). */
export interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const SPEC_INPUTS = {
  xml: { type: "string", description: "The .rqml document text (alternative to path)." },
  path: {
    type: "string",
    description:
      "Filesystem path of the .rqml document; read without modification (REQ-MCP-PATH-INPUT).",
  },
  baseDir: {
    type: "string",
    description:
      "Directory code links resolve against. Defaults to the spec's directory when path is given, else the working directory.",
  },
} as const;

const specOnly = {
  type: "object" as const,
  properties: { xml: SPEC_INPUTS.xml, path: SPEC_INPUTS.path },
};

const specAndId = {
  type: "object" as const,
  properties: {
    xml: SPEC_INPUTS.xml,
    path: SPEC_INPUTS.path,
    id: { type: "string", description: "Artifact id to query." },
  },
  required: ["id"],
};

export const TOOLS: ToolDef[] = [
  {
    name: "rqml_validate",
    description: "Validate an RQML document against the XSD and referential integrity.",
    inputSchema: specOnly,
  },
  {
    name: "rqml_status",
    description:
      "Summarize an RQML document: requirement count, trace coverage, and dangling references.",
    inputSchema: specOnly,
  },
  {
    name: "rqml_check",
    description:
      "Run the deterministic enforcement gate (validation + coverage + drift) and return a pass/fail verdict.",
    inputSchema: {
      type: "object",
      properties: {
        ...SPEC_INPUTS,
        strictness: {
          type: "string",
          enum: ["relaxed", "standard", "strict", "certified"],
        },
      },
    },
  },
  {
    name: "rqml_trace",
    description: "Resolve the trace graph and report dangling local references.",
    inputSchema: specOnly,
  },
  {
    name: "rqml_show",
    description:
      "Extract one artifact by id — statement, acceptance criteria, and trace neighborhood — as structured data plus markdown.",
    inputSchema: specAndId,
  },
  {
    name: "rqml_impact",
    description:
      "What is affected, transitively, if this artifact changes? Trace-graph traversal in both directions.",
    inputSchema: specAndId,
  },
  {
    name: "rqml_matrix",
    description:
      "Traceability matrix: one row per requirement with status, upstream goals, implementing code, verifying tests, and coverage warnings — as structured data plus a markdown table. Optional status/type/warning filters (comma-separated).",
    inputSchema: {
      type: "object",
      properties: {
        xml: SPEC_INPUTS.xml,
        path: SPEC_INPUTS.path,
        status: {
          type: "string",
          description:
            "Comma-separated requirement statuses to include (e.g. draft,review).",
        },
        type: {
          type: "string",
          description: "Comma-separated requirement types to include (e.g. FR,NFR).",
        },
        warning: {
          type: "string",
          description:
            "Comma-separated warning codes to filter to: unverified, unimplemented, orphan, premature, broken-trace.",
        },
      },
    },
  },
  {
    name: "rqml_skeleton",
    description: `Generate a schema-valid RQML snippet (${SKELETON_KINDS.join(", ")}).`,
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: [...SKELETON_KINDS] },
        id: { type: "string", description: "Override the snippet's root id." },
      },
      required: ["kind"],
    },
  },
  {
    name: "rqml_link",
    description:
      "Record or maintain an implements/verifiedBy trace edge in the spec FILE and its drift baseline. Modes: append (default) adds a new edge; update repoints an existing edge's external locator; refresh re-records the drift baseline for one edge without touching the spec. Writes to disk — requires path (explicit caller intent per REQ-MCP-READONLY).",
    inputSchema: {
      type: "object",
      properties: {
        path: SPEC_INPUTS.path,
        baseDir: SPEC_INPUTS.baseDir,
        mode: {
          type: "string",
          enum: ["append", "update", "refresh"],
          description:
            "append (default): add a new edge. update: replace the external locator of an existing edge. refresh: re-record the baseline entry for edgeId only.",
        },
        artifactId: {
          type: "string",
          description:
            "Declared artifact id (usually a requirement). Required in append/update modes.",
        },
        uri: {
          type: "string",
          description:
            "External locator of the code or test artifact. Required in append/update modes.",
        },
        type: { type: "string", enum: ["implements", "verifiedBy"] },
        edgeId: {
          type: "string",
          description:
            "Explicit edge id (derived from artifactId when omitted). Required in refresh mode.",
        },
        kind: {
          type: "string",
          description: "Locator kind hint (default code/test by type).",
        },
        title: { type: "string", description: "Locator title hint." },
      },
      required: ["path"],
    },
  },
];

function str(args: Record<string, unknown>, name: string): string | undefined {
  const value = args[name];
  return typeof value === "string" ? value : undefined;
}

/** Resolve the spec text and base directory from `xml` or `path` input. */
function resolveSpec(args: Record<string, unknown>): { xml: string; baseDir: string } {
  const path = str(args, "path");
  const inline = str(args, "xml");
  const explicitBase = str(args, "baseDir");
  if (path !== undefined) {
    const resolved = resolve(path);
    return {
      xml: readFileSync(resolved, "utf8"),
      baseDir: explicitBase ?? dirname(resolved),
    };
  }
  if (inline !== undefined) {
    return { xml: inline, baseDir: explicitBase ?? process.cwd() };
  }
  throw new Error("provide either xml (document text) or path (spec file)");
}

/**
 * Execute a tool by name. Backed entirely by @rqml/core, so results are
 * equivalent to the corresponding `rqml` CLI command (REQ-MCP-PARITY). Every
 * tool is read-only except rqml_link, which writes the named spec file and
 * the drift baseline store on explicit caller intent (REQ-MCP-READONLY).
 */
export async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "rqml_validate": {
      const { xml } = resolveSpec(args);
      const { validate } = await import("@rqml/core/validate");
      const result = validate(xml);
      const integrity = result.valid ? checkIntegrity(xml) : [];
      return {
        valid: result.valid && integrity.length === 0,
        schemaVersion: result.schemaVersion,
        diagnostics: [...result.diagnostics, ...integrity],
      };
    }
    case "rqml_status": {
      const { xml } = resolveSpec(args);
      const parsed = parse(xml);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      const doc = parsed.document;
      const coverage = computeCoverage(doc);
      return {
        docId: doc.docId,
        version: doc.version,
        status: doc.status,
        requirements:
          doc.packages.reduce((n, p) => n + p.requirements.length, 0) +
          doc.looseRequirements.length,
        edges: doc.trace.length,
        uncoveredGoals: coverage.uncoveredGoals,
        unverifiedRequirements: coverage.unverifiedRequirements,
        unimplementedRequirements: coverage.unimplementedRequirements,
        unimplementedApprovedRequirements: coverage.unimplementedApprovedRequirements,
        prematureImplementations: coverage.prematureImplementations,
        orphanRequirements: coverage.orphanRequirements,
      };
    }
    case "rqml_check": {
      const { xml, baseDir } = resolveSpec(args);
      const { validate } = await import("@rqml/core/validate");
      const validation = validate(xml);
      const integrity = validation.valid ? checkIntegrity(xml) : [];
      const parsed = parse(xml);
      const baseline = loadBaseline(baseDir);
      const coverage = parsed.ok ? computeCoverage(parsed.document) : undefined;
      const drift = parsed.ok
        ? detectDrift(parsed.document, {
            baseDir,
            ...(baseline !== undefined ? { baseline } : {}),
          })
        : undefined;
      const strictness = str(args, "strictness") ?? "standard";
      const coverageBlocks = strictness === "strict" || strictness === "certified";
      const validationFailed = !validation.valid || integrity.length > 0;
      const driftFailed = (drift?.drifted.length ?? 0) > 0;
      const coverageProblem =
        (coverage?.uncoveredGoals.length ?? 0) +
          (coverage?.unverifiedRequirements.length ?? 0) +
          (coverage?.orphanRequirements.length ?? 0) +
          (coverage?.unimplementedApprovedRequirements.length ?? 0) +
          (coverage?.prematureImplementations.length ?? 0) >
        0;
      const coverageFailed = coverageBlocks && coverageProblem;
      const verdict = validationFailed || driftFailed || coverageFailed ? "fail" : "pass";
      return {
        verdict,
        strictness,
        valid: !validationFailed,
        drift: drift?.drifted ?? [],
        coverage: coverage
          ? {
              uncoveredGoals: coverage.uncoveredGoals,
              unverifiedRequirements: coverage.unverifiedRequirements,
              unimplementedRequirements: coverage.unimplementedRequirements,
              unimplementedApprovedRequirements:
                coverage.unimplementedApprovedRequirements,
              prematureImplementations: coverage.prematureImplementations,
              orphanRequirements: coverage.orphanRequirements,
            }
          : null,
      };
    }
    case "rqml_trace": {
      const { xml } = resolveSpec(args);
      const parsed = parse(xml);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      const resolution = resolveTrace(parsed.document);
      return { edges: resolution.edges.length, dangling: resolution.diagnostics };
    }
    case "rqml_show": {
      const { xml } = resolveSpec(args);
      const id = str(args, "id");
      if (id === undefined) throw new Error("id is required");
      const parsed = parse(xml);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      const slice = extractArtifact(parsed.document, id);
      if (slice === undefined) return { ok: false, error: `no artifact with id "${id}"` };
      return { ...slice, markdown: sliceToMarkdown(slice) };
    }
    case "rqml_impact": {
      const { xml } = resolveSpec(args);
      const id = str(args, "id");
      if (id === undefined) throw new Error("id is required");
      const parsed = parse(xml);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      if (!declaredIdIndex(parsed.document).has(id)) {
        return { ok: false, error: `no artifact with id "${id}"` };
      }
      return impactOf(parsed.document, id);
    }
    case "rqml_matrix": {
      const { xml } = resolveSpec(args);
      const parsed = parse(xml);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      const list = (v: string | undefined): string[] | undefined =>
        v === undefined
          ? undefined
          : v
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
      const status = list(str(args, "status"));
      const type = list(str(args, "type"));
      const warning = list(str(args, "warning"));
      const filter: MatrixFilter = {};
      if (status) filter.status = status;
      if (type) filter.type = type;
      if (warning) filter.warning = warning;
      const filtered =
        status !== undefined || type !== undefined || warning !== undefined;
      const matrix = buildMatrix(parsed.document, filtered ? filter : undefined);
      return { ...matrix, markdown: matrixToMarkdown(matrix) };
    }
    case "rqml_skeleton": {
      const kind = str(args, "kind");
      if (kind === undefined || !(SKELETON_KINDS as readonly string[]).includes(kind)) {
        throw new Error(`kind must be one of: ${SKELETON_KINDS.join(", ")}`);
      }
      const id = str(args, "id");
      return { snippet: skeleton(kind as SkeletonKind, id !== undefined ? { id } : {}) };
    }
    case "rqml_link": {
      const path = str(args, "path");
      if (path === undefined)
        throw new Error("path is required: rqml_link writes the spec file");
      const { xml, baseDir } = resolveSpec({ ...args, xml: undefined });
      const mode = str(args, "mode") ?? "append";
      if (mode !== "append" && mode !== "update" && mode !== "refresh") {
        throw new Error(`unknown link mode "${mode}" (append|update|refresh)`);
      }

      if (mode === "refresh") {
        // Edge-scoped on purpose: the spec document is never touched, and no
        // other entry is re-hashed (REQ-LOOP-RELINK).
        const edgeId = str(args, "edgeId");
        if (edgeId === undefined) throw new Error("edgeId is required in refresh mode");
        const parsed = parse(xml);
        if (!parsed.ok) return { ok: false, error: parsed.error.message };
        const link = implementsLinks(parsed.document).find((l) => l.edgeId === edgeId);
        if (link === undefined) {
          return {
            ok: false,
            error: `no implements edge "${edgeId}" with an external locator exists (only implements edges carry baselines)`,
          };
        }
        const hash = computeBaseline(parsed.document, { baseDir })[edgeId];
        if (hash === undefined) {
          return {
            ok: false,
            error: `"${link.uri}" cannot be hashed (missing file or non-filesystem URI)`,
          };
        }
        const baseline = loadBaseline(baseDir) ?? {};
        baseline[edgeId] = hash;
        saveBaseline(baseDir, baseline);
        return { ok: true, mode, edgeId, uri: link.uri, hash };
      }

      const artifactId = str(args, "artifactId");
      const uri = str(args, "uri");
      if (artifactId === undefined || uri === undefined) {
        throw new Error(`artifactId and uri are required in ${mode} mode`);
      }
      const type = str(args, "type") ?? "implements";
      if (type !== "implements" && type !== "verifiedBy") {
        throw new Error(`unknown link type "${type}" (implements|verifiedBy)`);
      }
      const request: LinkRequest = { artifactId, uri, type };
      const edgeId = str(args, "edgeId");
      if (edgeId !== undefined) request.edgeId = edgeId;
      const kind = str(args, "kind");
      if (kind !== undefined) request.kind = kind;
      const title = str(args, "title");
      if (title !== undefined) request.title = title;

      const result =
        mode === "update" ? updateTraceEdge(xml, request) : appendTraceEdge(xml, request);
      if (!result.ok) return { ok: false, error: result.error };
      const { validate } = await import("@rqml/core/validate");
      const validation = validate(result.xml);
      if (!validation.valid) {
        return {
          ok: false,
          error: "link would invalidate the document; nothing written",
          diagnostics: validation.diagnostics,
        };
      }
      writeFileSync(resolve(path), result.xml);

      let baselineRecorded = false;
      const reparsed = parse(result.xml);
      if (reparsed.ok) {
        const fresh = computeBaseline(reparsed.document, { baseDir });
        const hash = fresh[result.edgeId];
        if (hash !== undefined) {
          const baseline = loadBaseline(baseDir) ?? {};
          baseline[result.edgeId] = hash;
          saveBaseline(baseDir, baseline);
          baselineRecorded = true;
        }
      }
      return {
        ok: true,
        mode,
        edgeId: result.edgeId,
        type,
        artifactId,
        uri,
        baselineRecorded,
        ...("previousUri" in result ? { previousUri: result.previousUri } : {}),
      };
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}
