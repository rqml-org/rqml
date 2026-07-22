import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  type LinkRequest,
  type MatrixFilter,
  type ProjectionFilter,
  SKELETON_KINDS,
  type SkeletonKind,
  TRACE_TYPES,
  type TraceType,
  appendTraceEdge,
  approvalGate,
  buildMatrix,
  buildOutline,
  checkIntegrity,
  computeBaseline,
  computeCoverage,
  declaredIdIndex,
  decodeBaselineEntry,
  detectDrift,
  discoverSpecs,
  extractArtifact,
  impactOf,
  implementsLinks,
  loadBaseline,
  matrixToMarkdown,
  outlineToMarkdown,
  parse,
  projectOutline,
  resolveGoverningSpec,
  resolveTrace,
  saveBaseline,
  setStatus,
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
  file: {
    type: "string",
    description:
      "A file or directory whose governing spec to resolve by nearest-wins discovery (alternative to xml/path; REQ-CORE-SPEC-DISCOVERY).",
  },
  baseDir: {
    type: "string",
    description:
      "Directory code links resolve against. Defaults to the spec's directory when path is given, else the working directory.",
  },
} as const;

const specOnly = {
  type: "object" as const,
  properties: { xml: SPEC_INPUTS.xml, path: SPEC_INPUTS.path, file: SPEC_INPUTS.file },
};

const specAndId = {
  type: "object" as const,
  properties: {
    xml: SPEC_INPUTS.xml,
    path: SPEC_INPUTS.path,
    file: SPEC_INPUTS.file,
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
    name: "rqml_discover",
    description:
      "Discover the RQML specs a repository holds (nearest-wins, REQ-CORE-SPEC-DISCOVERY): enumerate every governing spec beneath root (and the ambiguous directories), plus — when file is given — the single spec governing that path. Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        root: {
          type: "string",
          description:
            "Directory to enumerate governing specs beneath, and the upper boundary for resolving file.",
        },
        file: {
          type: "string",
          description:
            "Optional file or directory whose governing spec to resolve, bounded by root.",
        },
      },
      required: ["root"],
    },
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
    name: "rqml_overview",
    description:
      "A readable projection of the spec — the whole document, or a subset scoped by section title or element id — as a structured outline plus markdown.",
    inputSchema: {
      type: "object",
      properties: {
        xml: SPEC_INPUTS.xml,
        path: SPEC_INPUTS.path,
        section: {
          type: "string",
          description:
            "Comma-separated section titles to keep (e.g. Goals,Requirements).",
        },
        id: {
          type: "string",
          description:
            "Comma-separated element ids to keep (a package id keeps the whole package).",
        },
      },
    },
  },
  {
    name: "rqml_approve",
    description:
      "Transition a requirement's lifecycle status (default approved). Writes the spec FILE textually, re-validating first — requires path (explicit caller intent per REQ-MCP-READONLY).",
    inputSchema: {
      type: "object",
      properties: {
        path: SPEC_INPUTS.path,
        id: { type: "string", description: "Declared artifact id to transition." },
        status: {
          type: "string",
          enum: ["draft", "review", "approved", "deprecated"],
          description: "Target lifecycle status (default approved).",
        },
      },
      required: ["path", "id"],
    },
  },
  {
    name: "rqml_gate",
    description:
      "Approval-before-implementation verdict: implements edges whose requirement is not approved, optionally scoped to changed paths. blocked=true means an external control loop should block the edit.",
    inputSchema: {
      type: "object",
      properties: {
        xml: SPEC_INPUTS.xml,
        path: SPEC_INPUTS.path,
        changed: {
          type: "string",
          description: "Comma-separated changed paths to scope the verdict to.",
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
      "Record or maintain a trace edge in the spec FILE and its drift baseline. Modes: append (default) adds a new edge of any trace type between two endpoints (each a declared artifact id or an external URI; implements/verifiedBy are auto-oriented, other types are recorded exactly from → to); update repoints an existing implements/verifiedBy edge's external locator; refresh re-records the drift baseline for one edge without touching the spec. New edges are stamped status=draft and createdBy unless overridden. Writes to disk — requires path (explicit caller intent per REQ-MCP-READONLY).",
    inputSchema: {
      type: "object",
      properties: {
        path: SPEC_INPUTS.path,
        baseDir: SPEC_INPUTS.baseDir,
        mode: {
          type: "string",
          enum: ["append", "update", "refresh"],
          description:
            "append (default): add a new edge. update: replace the external locator of an existing implements/verifiedBy edge. refresh: re-record the baseline entry for edgeId only.",
        },
        from: {
          type: "string",
          description:
            "Source endpoint: a declared artifact id or an external locator URI. Required in append mode (or pass artifactId/uri).",
        },
        to: {
          type: "string",
          description:
            "Target endpoint: a declared artifact id or an external locator URI. Required in append mode (or pass artifactId/uri).",
        },
        artifactId: {
          type: "string",
          description:
            "Legacy alias: declared artifact id. With uri, equivalent to from=artifactId, to=uri. Required in update mode.",
        },
        uri: {
          type: "string",
          description:
            "Legacy alias: external locator of the code or test artifact. Required in update mode.",
        },
        type: { type: "string", enum: [...TRACE_TYPES] },
        edgeId: {
          type: "string",
          description:
            "Explicit edge id (derived from the type and local endpoint(s) when omitted). Required in refresh mode.",
        },
        kind: {
          type: "string",
          description:
            "External locator kind hint (default code/test for implements/verifiedBy).",
        },
        title: { type: "string", description: "External locator title hint." },
        notes: {
          type: "string",
          description: "Why this relationship exists; recorded as the edge's notes.",
        },
        confidence: {
          type: "number",
          description: "Certainty of the relationship, 0.0-1.0.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: 'Category tags (NMTOKENs), e.g. ["safety", "compliance"].',
        },
        status: {
          type: "string",
          enum: ["draft", "review", "approved", "deprecated"],
          description: "Edge lifecycle status; new edges default to draft.",
        },
        createdBy: {
          type: "string",
          description: "Provenance identity; defaults to a toolchain-recorded edge.",
        },
      },
      required: ["path"],
    },
  },
];

function str(args: Record<string, unknown>, name: string): string | undefined {
  const value = args[name];
  return typeof value === "string" ? value : undefined;
}

/** Validate the edited document and write it, or return the error result. */
async function writeValidated(
  path: string,
  xml: string,
): Promise<Record<string, unknown> | undefined> {
  const { validate } = await import("@rqml/core/validate");
  const validation = validate(xml);
  if (!validation.valid) {
    return {
      ok: false,
      error: "link would invalidate the document; nothing written",
      diagnostics: validation.diagnostics,
    };
  }
  writeFileSync(resolve(path), xml);
  return undefined;
}

/** Hash the newly linked artifact only — re-hashing every link here would
 * silently bless drifted artifacts. */
function recordBaseline(xml: string, edgeId: string, baseDir: string): boolean {
  const reparsed = parse(xml);
  if (!reparsed.ok) return false;
  const fresh = computeBaseline(reparsed.document, { baseDir });
  const hash = fresh[edgeId];
  if (hash === undefined) return false;
  const baseline = loadBaseline(baseDir) ?? {};
  baseline[edgeId] = hash;
  saveBaseline(baseDir, baseline);
  return true;
}

/**
 * Resolve the spec text and base directory from `xml`, `path`, or `file` input.
 * `file` (a file or directory) resolves the governing spec by nearest-wins
 * discovery (REQ-CORE-SPEC-DISCOVERY); `path` and `xml` take precedence.
 */
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
  const from = str(args, "file");
  if (from !== undefined) {
    const found = resolveGoverningSpec(from);
    if (found.kind === "resolved") {
      return {
        xml: readFileSync(found.specPath, "utf8"),
        baseDir: explicitBase ?? found.dir,
      };
    }
    if (found.kind === "ambiguous") {
      throw new Error(
        `multiple .rqml documents in ${found.dir} and no requirements.rqml (${found.candidates.join(", ")})`,
      );
    }
    throw new Error(`no .rqml document governs ${from}`);
  }
  throw new Error(
    "provide xml (document text), path (spec file), or file (resolve the governing spec)",
  );
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
      // A file that changed around an unchanged fragment is not implementation
      // drift, so it is advisory except at certified (REQ-CORE-DRIFT-SCOPE).
      const driftFailed =
        (drift?.drifted.length ?? 0) > 0 ||
        (strictness === "certified" && (drift?.contextChanged.length ?? 0) > 0);
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
        contextChanged: drift?.contextChanged ?? [],
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
    case "rqml_overview": {
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
      const filter: ProjectionFilter = {};
      const sections = list(str(args, "section"));
      const ids = list(str(args, "id"));
      if (sections) filter.sections = sections;
      if (ids) filter.ids = ids;
      const outline = projectOutline(buildOutline(parsed.document), filter);
      return { outline, markdown: outlineToMarkdown(outline) };
    }
    case "rqml_discover": {
      const root = str(args, "root");
      if (root === undefined) {
        throw new Error("root is required: the directory to discover specs beneath");
      }
      const { specs, ambiguous } = discoverSpecs(root);
      const file = str(args, "file");
      return {
        root: resolve(root),
        specs,
        ambiguous,
        ...(file !== undefined
          ? { governing: resolveGoverningSpec(file, { root }) }
          : {}),
      };
    }
    case "rqml_approve": {
      const path = str(args, "path");
      if (path === undefined)
        throw new Error("path is required: rqml_approve writes the spec file");
      const { xml } = resolveSpec({ ...args, xml: undefined });
      const id = str(args, "id");
      if (id === undefined) throw new Error("id is required");
      const status = str(args, "status") ?? "approved";
      const result = setStatus(xml, { artifactId: id, status });
      if (!result.ok) return { ok: false, error: result.error };
      writeFileSync(resolve(path), result.xml);
      return { ok: true, id, status, previousStatus: result.previousStatus ?? null };
    }
    case "rqml_gate": {
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
      const changed = list(str(args, "changed"));
      return approvalGate(parsed.document, changed ? { changedPaths: changed } : {});
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
        const scope =
          decodeBaselineEntry(hash)?.spanHash !== undefined ? "fragment" : "file";
        return { ok: true, mode, edgeId, uri: link.uri, hash, scope };
      }

      const type = str(args, "type") ?? "implements";
      if (!(TRACE_TYPES as readonly string[]).includes(type)) {
        throw new Error(`unknown link type "${type}" (${TRACE_TYPES.join("|")})`);
      }
      const edgeId = str(args, "edgeId");
      const kind = str(args, "kind");
      const title = str(args, "title");
      const artifactId = str(args, "artifactId");
      const uri = str(args, "uri");

      if (mode === "update") {
        if (type !== "implements" && type !== "verifiedBy") {
          throw new Error("update mode maintains implements/verifiedBy edges only");
        }
        if (artifactId === undefined || uri === undefined) {
          throw new Error("artifactId and uri are required in update mode");
        }
        const request: Parameters<typeof updateTraceEdge>[1] = { artifactId, uri, type };
        if (edgeId !== undefined) request.edgeId = edgeId;
        if (kind !== undefined) request.kind = kind;
        if (title !== undefined) request.title = title;
        const result = updateTraceEdge(xml, request);
        if (!result.ok) return { ok: false, error: result.error };
        const written = await writeValidated(path, result.xml);
        if (written !== undefined) return written;
        return {
          ok: true,
          mode,
          edgeId: result.edgeId,
          type,
          artifactId,
          uri,
          baselineRecorded: recordBaseline(result.xml, result.edgeId, baseDir),
          previousUri: result.previousUri,
        };
      }

      // append: from/to endpoints, with artifactId/uri accepted as the
      // legacy spelling of the same request.
      const from = str(args, "from") ?? artifactId;
      const to = str(args, "to") ?? uri;
      if (from === undefined || to === undefined) {
        throw new Error("from and to endpoints are required in append mode");
      }
      const request: LinkRequest = { from, to, type: type as TraceType };
      if (edgeId !== undefined) request.edgeId = edgeId;
      if (kind !== undefined) request.kind = kind;
      if (title !== undefined) request.title = title;
      const notes = str(args, "notes");
      if (notes !== undefined) request.notes = notes;
      if (typeof args.confidence === "number") request.confidence = args.confidence;
      if (Array.isArray(args.tags)) {
        request.tags = args.tags.filter((t): t is string => typeof t === "string");
      }
      const status = str(args, "status");
      if (status !== undefined) request.status = status as LinkRequest["status"];
      const createdBy = str(args, "createdBy");
      if (createdBy !== undefined) request.createdBy = createdBy;

      const result = appendTraceEdge(xml, request);
      if (!result.ok) return { ok: false, error: result.error };
      const written = await writeValidated(path, result.xml);
      if (written !== undefined) return written;
      return {
        ok: true,
        mode,
        edgeId: result.edgeId,
        type,
        from: result.from,
        to: result.to,
        status: request.status ?? "draft",
        baselineRecorded: recordBaseline(result.xml, result.edgeId, baseDir),
      };
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}
