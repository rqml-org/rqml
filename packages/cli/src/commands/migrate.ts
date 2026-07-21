import { writeFileSync } from "node:fs";
import { MIGRATE_TARGET, migrateDocument } from "@rqml/core";
import { printDiagnostics } from "../report.js";
import { EXIT, UsageError, parseArgs, readSpec, specArgs } from "../runtime.js";

const USAGE = "usage: rqml migrate [path] [--dry-run] [--spec <path>]";

/**
 * Options this command understands; anything else is refused rather than
 * ignored (REQ-CLI-SAFE-INVOCATION). migrate rewrites the user's source of
 * truth and takes no required argument, so an unrecognized flag must never be
 * silently dropped and allowed to fall through to a write.
 */
const KNOWN_FLAGS = new Set(["dry-run", "spec", "base-dir", "json", "strictness"]);

/**
 * `rqml migrate` — rewrite a 2.0.1/2.1.0 spec to the current schema version
 * (REQ-LOOP-MIGRATE, RFC-0003): root version/namespace updated, every trace
 * edge re-emitted in canonical compact form, everything else byte-identical.
 * The drift baseline is deliberately NOT touched: baselines hash linked
 * ARTIFACT content keyed by edge id, and migration changes neither, so the
 * recorded state carries over exactly — including any pre-existing drift,
 * which must stay visible rather than be silently blessed. The file is only
 * written when the migrated document validates against the target schema.
 */
export async function runMigrate(rest: string[]): Promise<number> {
  const args = parseArgs(rest);
  for (const name of args.flags.keys()) {
    if (!KNOWN_FLAGS.has(name)) {
      throw new UsageError(`unknown option "--${name}"\n${USAGE}`);
    }
  }
  const dryRun =
    args.flags.get("dry-run") === true || args.flags.get("dry-run") === "true";
  if (args.positionals.length > 1) throw new UsageError(USAGE);

  const { path, xml } = readSpec(specArgs(args));
  const result = migrateDocument(xml);
  if (!result.ok) {
    process.stderr.write(`✗ migrate failed: ${result.error}\n`);
    return EXIT.VALIDATION;
  }
  if (!result.changed) {
    if (args.json) {
      const report = { spec: path, changed: false, version: MIGRATE_TARGET };
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write(`✓ ${path} is already ${MIGRATE_TARGET}\n`);
    }
    return EXIT.OK;
  }

  const { validate } = await import("@rqml/core/validate");
  const validation = validate(result.xml);
  if (!validation.valid) {
    printDiagnostics(validation.diagnostics);
    process.stderr.write(
      `✗ migrated document does not validate against ${MIGRATE_TARGET}; nothing written\n`,
    );
    return EXIT.VALIDATION;
  }

  if (dryRun) {
    if (args.json) {
      const report = {
        spec: path,
        dryRun: true,
        from: result.fromVersion,
        to: result.toVersion,
        edgesRewritten: result.edgesRewritten,
        bytesBefore: Buffer.byteLength(xml),
        bytesAfter: Buffer.byteLength(result.xml),
      };
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write(
        `✓ would migrate ${path}: ${result.fromVersion} → ${result.toVersion}, ` +
          `${result.edgesRewritten} edges, ${Buffer.byteLength(xml)} → ${Buffer.byteLength(result.xml)} bytes (dry run)\n`,
      );
    }
    return EXIT.OK;
  }

  writeFileSync(path, result.xml);

  if (args.json) {
    const report = {
      spec: path,
      from: result.fromVersion,
      to: result.toVersion,
      edgesRewritten: result.edgesRewritten,
      bytesBefore: Buffer.byteLength(xml),
      bytesAfter: Buffer.byteLength(result.xml),
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(
      `✓ migrated ${path}: ${result.fromVersion} → ${result.toVersion}, ` +
        `${result.edgesRewritten} edges rewritten, ` +
        `${Buffer.byteLength(xml)} → ${Buffer.byteLength(result.xml)} bytes\n`,
    );
  }
  return EXIT.OK;
}
