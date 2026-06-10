import { SKELETON_KINDS, type SkeletonKind, skeleton } from "@rqml/core";
import { EXIT, UsageError, flagString, parseArgs } from "../runtime.js";

/**
 * `rqml skeleton` — print a schema-valid RQML snippet (REQ-LOOP-SKELETON) so
 * authors and agents never hand-roll invalid structure.
 */
export async function runSkeleton(rest: string[]): Promise<number> {
  const args = parseArgs(rest);
  const kind = args.positionals[0];
  const kinds = SKELETON_KINDS.join("|");
  if (kind === undefined || !(SKELETON_KINDS as readonly string[]).includes(kind)) {
    throw new UsageError(`usage: rqml skeleton <${kinds}> [--id <id>]`);
  }
  const id = flagString(args, "id");
  process.stdout.write(skeleton(kind as SkeletonKind, id !== undefined ? { id } : {}));
  return EXIT.OK;
}
