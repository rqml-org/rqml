import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AGENTS_TEMPLATE,
  DEFAULT_SCHEMA_VERSION,
  schemaNamespace,
  schemaUrl,
} from "@rqml/schema";
import { EXIT, type Strictness, parseArgs } from "../runtime.js";

/**
 * The scaffolded spec is pinned to {@link DEFAULT_SCHEMA_VERSION} rather than a
 * literal, so a schema release can never leave `rqml init` starting new projects
 * on the previous generation — which is exactly what happened through the 2.2.0
 * release, when this string still said 2.1.0. It carries `xsi:schemaLocation` so
 * the scaffolded document exercises the same published-URL contract every other
 * RQML document depends on.
 */
const STARTER_SPEC = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="${schemaNamespace(DEFAULT_SCHEMA_VERSION)}"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="${schemaNamespace(DEFAULT_SCHEMA_VERSION)} ${schemaUrl(DEFAULT_SCHEMA_VERSION)}"
      version="${DEFAULT_SCHEMA_VERSION}" docId="PROJECT-001" status="draft">
  <meta>
    <title>My Project</title>
    <system>my-system</system>
  </meta>
  <requirements>
    <req id="REQ-EXAMPLE" type="FR" title="Example requirement" priority="must" status="draft">
      <statement>The system SHALL do something useful.</statement>
    </req>
  </requirements>
</rqml>
`;

/**
 * Managed-block markers (REQ-CLI-INIT-MERGE). `rqml init` owns only the text
 * between BEGIN and END; everything else in an existing AGENTS.md is preserved
 * verbatim. The BEGIN marker is matched loosely (`<!-- BEGIN RQML` … END) so its
 * human-readable hint can evolve without orphaning blocks written by older CLIs.
 */
const RQML_BEGIN =
  "<!-- BEGIN RQML — managed by `rqml init`; edit outside this block, refresh by re-running `rqml init` -->";
const RQML_END = "<!-- END RQML -->";
const BLOCK_RE = /<!-- BEGIN RQML\b[\s\S]*?<!-- END RQML -->/;
const STRICTNESS_RE =
  /^(#{1,3}\s*Strictness:\s*)`?(relaxed|standard|strict|certified)`?\s*$/m;

/** The strictness level a document already declares, or `null` if none. */
function declaredStrictness(text: string): Strictness | null {
  const m = text.match(STRICTNESS_RE);
  return m ? (m[2] as Strictness) : null;
}

/** The canonical template with its strictness declaration set to `level`. */
function templateAt(level: Strictness): string {
  return AGENTS_TEMPLATE.replace(STRICTNESS_RE, `$1\`${level}\``);
}

/** The managed RQML block — markers wrapping the template — for `level`. */
function rqmlBlock(level: Strictness): string {
  return `${RQML_BEGIN}\n${templateAt(level)}\n${RQML_END}`;
}

export type AgentsAction = "created" | "merged" | "refreshed" | "unchanged";

/**
 * Resolve the AGENTS.md content `rqml init` should write, given the existing
 * file's text (or `null` when absent) — REQ-CLI-INIT-MERGE:
 *  - no file              → the managed block alone (`created`)
 *  - file without a block  → the user's content, the block appended (`merged`)
 *  - file with a block      → the block refreshed in place (`refreshed`, or
 *                             `unchanged` when already current)
 *
 * The merge is non-destructive (text outside the block is never touched) and
 * idempotent. A strictness level the project already declares — inside the block
 * or in the surrounding prose — is carried into the regenerated block, so a
 * refresh never silently resets a team's chosen level back to `standard`.
 */
export function applyAgentsTemplate(existing: string | null): {
  content: string;
  action: AgentsAction;
} {
  const level = (existing && declaredStrictness(existing)) || "standard";
  const block = rqmlBlock(level);

  if (existing === null) return { content: `${block}\n`, action: "created" };

  if (BLOCK_RE.test(existing)) {
    // Function replacer: the template may contain `$`, which a string
    // replacement would misread as a capture-group reference.
    const content = existing.replace(BLOCK_RE, () => block);
    return content === existing
      ? { content: existing, action: "unchanged" }
      : { content, action: "refreshed" };
  }

  const separator = existing.endsWith("\n\n")
    ? ""
    : existing.endsWith("\n")
      ? "\n"
      : "\n\n";
  return { content: `${existing}${separator}${block}\n`, action: "merged" };
}

/** `rqml init` — scaffold a starter spec and merge the RQML block into AGENTS.md. */
export async function runInit(rest: string[]): Promise<number> {
  const args = parseArgs(rest);
  const specPath = resolve(args.baseDir, args.positionals[0] ?? "requirements.rqml");
  const agentsPath = resolve(args.baseDir, "AGENTS.md");
  let wrote = false;

  if (existsSync(specPath)) {
    process.stdout.write(`skip (exists) ${specPath}\n`);
  } else {
    writeFileSync(specPath, STARTER_SPEC);
    process.stdout.write(`created ${specPath}\n`);
    wrote = true;
  }

  const existingAgents = existsSync(agentsPath) ? readFileSync(agentsPath, "utf8") : null;
  const { content, action } = applyAgentsTemplate(existingAgents);
  if (action === "unchanged") {
    process.stdout.write(`skip (up to date) ${agentsPath}\n`);
  } else {
    writeFileSync(agentsPath, content);
    const verb =
      action === "created"
        ? "created"
        : action === "merged"
          ? "merged RQML block into"
          : "refreshed RQML block in";
    process.stdout.write(`${verb} ${agentsPath}\n`);
    wrote = true;
  }

  if (!wrote) process.stdout.write("nothing to do; project already initialized\n");
  return EXIT.OK;
}
