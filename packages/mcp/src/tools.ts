import {
  checkIntegrity,
  computeCoverage,
  detectDrift,
  parse,
  resolveTrace,
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

const xmlOnly = {
  type: "object" as const,
  properties: {
    xml: { type: "string", description: "The .rqml document text." },
  },
  required: ["xml"],
};

export const TOOLS: ToolDef[] = [
  {
    name: "rqml_validate",
    description: "Validate an RQML document against the XSD and referential integrity.",
    inputSchema: xmlOnly,
  },
  {
    name: "rqml_status",
    description:
      "Summarize an RQML document: requirement count, trace coverage, and dangling references.",
    inputSchema: xmlOnly,
  },
  {
    name: "rqml_check",
    description:
      "Run the deterministic enforcement gate (validation + coverage + drift) and return a pass/fail verdict.",
    inputSchema: {
      type: "object",
      properties: {
        xml: { type: "string", description: "The .rqml document text." },
        baseDir: {
          type: "string",
          description: "Directory to resolve implements code links against.",
        },
        strictness: {
          type: "string",
          enum: ["relaxed", "standard", "strict", "certified"],
        },
      },
      required: ["xml"],
    },
  },
  {
    name: "rqml_trace",
    description: "Resolve the trace graph and report dangling local references.",
    inputSchema: xmlOnly,
  },
];

/**
 * Execute a tool by name. Backed entirely by @rqml/core, so results are
 * equivalent to the corresponding `rqml` CLI command (REQ-MCP-PARITY) and the
 * server performs no irreversible filesystem actions (REQ-MCP-READONLY).
 */
export async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const xml = typeof args.xml === "string" ? args.xml : "";

  switch (name) {
    case "rqml_validate": {
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
        orphanRequirements: coverage.orphanRequirements,
      };
    }
    case "rqml_check": {
      const { validate } = await import("@rqml/core/validate");
      const validation = validate(xml);
      const integrity = validation.valid ? checkIntegrity(xml) : [];
      const parsed = parse(xml);
      const baseDir = typeof args.baseDir === "string" ? args.baseDir : undefined;
      const coverage = parsed.ok ? computeCoverage(parsed.document) : undefined;
      const drift = parsed.ok ? detectDrift(parsed.document, { baseDir }) : undefined;
      const strictness =
        typeof args.strictness === "string" ? args.strictness : "standard";
      const coverageBlocks = strictness === "strict" || strictness === "certified";
      const validationFailed = !validation.valid || integrity.length > 0;
      const driftFailed = (drift?.drifted.length ?? 0) > 0;
      const coverageProblem =
        (coverage?.uncoveredGoals.length ?? 0) +
          (coverage?.unverifiedRequirements.length ?? 0) +
          (coverage?.orphanRequirements.length ?? 0) >
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
              orphanRequirements: coverage.orphanRequirements,
            }
          : null,
      };
    }
    case "rqml_trace": {
      const parsed = parse(xml);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      const resolution = resolveTrace(parsed.document);
      return { edges: resolution.edges.length, dangling: resolution.diagnostics };
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}
