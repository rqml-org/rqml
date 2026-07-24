#!/usr/bin/env node
import { createRequire } from "node:module";
import { runApprove } from "./commands/approve.js";
import { runCheck } from "./commands/check.js";
import { runGate } from "./commands/gate.js";
import { runImpact } from "./commands/impact.js";
import { runInit } from "./commands/init.js";
import { runLink } from "./commands/link.js";
import { runLint } from "./commands/lint.js";
import { runMatrix } from "./commands/matrix.js";
import { runMigrate } from "./commands/migrate.js";
import { runOverview } from "./commands/overview.js";
import { runShow } from "./commands/show.js";
import { runSkeleton } from "./commands/skeleton.js";
import { runStatus } from "./commands/status.js";
import { runValidate } from "./commands/validate.js";
import { EXIT, UsageError } from "./runtime.js";

// The version lives in package.json (changesets bumps it there); resolving it
// at runtime keeps `rqml --version` truthful. From dist/index.js and from
// src/index.ts alike, ../package.json is this package's manifest.
const VERSION = (createRequire(import.meta.url)("../package.json") as { version: string })
  .version;

const HELP = `rqml — RQML reference CLI (v${VERSION})

Usage:
  rqml <command> [spec.rqml] [options]

Commands:
  init [path]        Scaffold a starter spec and merge the RQML block into AGENTS.md
  validate [path]    Document validation: XML well-formedness, XSD, referential integrity
  status [path]      Show spec, coverage, and lint summary
  lint [path]        Semantic lint findings; severity scales with --strictness (exit 1 on error)
  check [path]       Deterministic gate: document validation + trace coverage + drift
  link <id> <uri>    Record a trace edge (any type) and its drift baseline
                     (--update repoints an existing edge; --refresh <edge-id>
                     re-records only the baseline for an intentional change)
  show <id>          Extract one artifact with its trace neighborhood
  overview [path]    Readable spec projection (whole, or --section/--id scoped)
  impact <id>        What is affected, transitively, if this artifact changes
  matrix [path]      Traceability matrix: status, goals, code, tests, warnings
  approve <id>       Transition a requirement's status (--status, default approved)
  gate [paths...]    Block implementation of non-approved requirements (exit 2)
  skeleton <kind>    Print a schema-valid snippet (req|edge|testCase|stateMachine)
  migrate [path]     Rewrite a 2.0.1/2.1.0 spec to the current schema version
                     (compact trace edges, RFC-0003; --dry-run to preview)

Options:
  --json                 Emit machine-readable JSON (reporting commands)
  --section, --id        Scope overview (comma-separated section titles or element ids)
  --status, --type, --warning  Filter matrix rows; for approve, --status sets the target (default approved)
  --changed <paths>      Scope gate to changed paths (or pass paths as positionals)
  --strictness <level>   relaxed | standard | strict | certified (default: standard)
  --base-dir <dir>       Where spec discovery starts / the --workspace root (code links resolve against the spec's own directory)
  --spec <path>          Explicit spec file (link, show, impact)
  --workspace, --all     validate/status/check: run across every spec in the repo (one exit code)
  --ignore <names>       Comma-separated directory names to skip during --workspace discovery
  --type <type>          Link type: implements | verifiedBy (default: implements)
  --id <id>              Explicit edge id (link) or skeleton root id
  --kind <kind>          Locator kind hint for link (default: code/test by type)
  --title <title>        Locator title hint for link
  --update               Replace the external locator of an existing edge (link)
  --refresh <edge-id>    Re-record the drift baseline for one edge (link)
  -h, --help             Show this help
  -v, --version          Show version

Exit codes: 0 ok · 1 validation failure · 2 check (drift/coverage) failure · 64 usage
`;

/** `-h`/`--help` anywhere in a command's arguments is a help request. */
const HELP_FLAGS = new Set(["-h", "--help"]);

async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;

  // A help request is never an action (REQ-CLI-SAFE-INVOCATION). Handled here,
  // before dispatch, so it holds for every command: previously only the command
  // position was checked, so `rqml migrate --help` fell through to the command,
  // which — having no required positional — discovered a spec and rewrote it.
  if (cmd !== undefined && rest.some((a) => HELP_FLAGS.has(a))) {
    process.stdout.write(HELP);
    return EXIT.OK;
  }

  switch (cmd) {
    case "validate":
      return runValidate(rest);
    case "status":
      return runStatus(rest);
    case "lint":
      return runLint(rest);
    case "check":
      return runCheck(rest);
    case "init":
      return runInit(rest);
    case "link":
      return runLink(rest);
    case "show":
      return runShow(rest);
    case "impact":
      return runImpact(rest);
    case "matrix":
      return runMatrix(rest);
    case "overview":
      return runOverview(rest);
    case "approve":
      return runApprove(rest);
    case "gate":
      return runGate(rest);
    case "skeleton":
      return runSkeleton(rest);
    case "migrate":
      return runMigrate(rest);
    case "-v":
    case "--version":
      process.stdout.write(`${VERSION}\n`);
      return EXIT.OK;
    case undefined:
    case "-h":
    case "--help":
      process.stdout.write(HELP);
      return EXIT.OK;
    default:
      process.stderr.write(`rqml: unknown command "${cmd}"\n\n${HELP}`);
      return EXIT.USAGE;
  }
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    const isUsage = err instanceof UsageError;
    process.stderr.write(`rqml: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = isUsage ? EXIT.USAGE : EXIT.VALIDATION;
  });
