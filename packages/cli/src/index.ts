#!/usr/bin/env node
import { runCheck } from "./commands/check.js";
import { runInit } from "./commands/init.js";
import { runStatus } from "./commands/status.js";
import { runValidate } from "./commands/validate.js";
import { EXIT, UsageError } from "./runtime.js";

const VERSION = "0.1.0";

const HELP = `rqml — RQML reference CLI (v${VERSION})

Usage:
  rqml <command> [spec.rqml] [options]

Commands:
  init [path]      Scaffold a starter spec and AGENTS.md project marker
  validate [path]  Validate XML well-formedness, XSD, and referential integrity
  status [path]    Show spec, coverage, and lint summary
  check [path]     Deterministic enforcement gate (validation + coverage + drift)

Options:
  --json                 Emit machine-readable JSON (status, check, validate)
  --strictness <level>   relaxed | standard | strict | certified (default: standard)
  --base-dir <dir>       Directory to resolve the spec and code links against
  -h, --help             Show this help
  -v, --version          Show version

Exit codes: 0 ok · 1 validation failure · 2 check (drift/coverage) failure · 64 usage
`;

async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case "validate":
      return runValidate(rest);
    case "status":
      return runStatus(rest);
    case "check":
      return runCheck(rest);
    case "init":
      return runInit(rest);
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
