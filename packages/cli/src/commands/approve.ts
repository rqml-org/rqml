import { writeFileSync } from "node:fs";
import { setStatus } from "@rqml/core";
import {
  EXIT,
  UsageError,
  flagString,
  parseArgs,
  readSpec,
  specArgs,
} from "../runtime.js";

/**
 * `rqml approve <id>` — transition a requirement's lifecycle status
 * (REQ-LOOP-APPROVE), defaulting to `approved`. Backed by @rqml/core setStatus:
 * a textual, comment-preserving edit that re-validates before writing. The write
 * is explicit caller intent, like `rqml link` (REQ-MCP-READONLY).
 */
export async function runApprove(rest: string[]): Promise<number> {
  const args = parseArgs(rest);
  const id = args.positionals[0];
  if (id === undefined) {
    throw new UsageError("usage: rqml approve <id> [--status approved] [--spec <path>]");
  }
  const { path, xml } = readSpec(specArgs(args));
  const status = flagString(args, "status") ?? "approved";

  const result = setStatus(xml, { artifactId: id, status });
  if (!result.ok) {
    process.stderr.write(`✗ ${result.error}\n`);
    return EXIT.VALIDATION;
  }
  writeFileSync(path, result.xml);

  if (args.json) {
    const out = { ok: true, id, status, previousStatus: result.previousStatus ?? null };
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  } else {
    process.stdout.write(
      `✓ ${id}: ${result.previousStatus ?? "(unset)"} → ${status} in ${path}\n`,
    );
  }
  return EXIT.OK;
}
