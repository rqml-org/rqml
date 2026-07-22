import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { resolveGoverningSpec } from "@rqml/core";

/**
 * The ADR directory that belongs to a spec: `.rqml/adr/` beside it, per the
 * canonical layout (REQ-ADR-CONVENTION). Derived rather than configured so a
 * project that follows the convention needs no setup, and so every command
 * agrees on where the records live.
 */
export function adrDirFor(specPath: string): string {
  return join(dirname(resolve(specPath)), ".rqml", "adr");
}

/**
 * Documented, stable process exit codes (REQ-CLI-EXIT-CODES). Loosely follows
 * sysexits.h: usage errors are 64.
 */
export const EXIT = {
  OK: 0,
  /** The document is not well-formed, schema-invalid, or fails integrity. */
  VALIDATION: 1,
  /** The check gate failed on blocking drift or coverage. */
  CHECK: 2,
  /** The command was invoked incorrectly. */
  USAGE: 64,
} as const;

export type Strictness = "relaxed" | "standard" | "strict" | "certified";

export interface Args {
  positionals: string[];
  json: boolean;
  strictness: Strictness;
  baseDir: string;
  /** Every raw `--flag` value, for command-specific options. */
  flags: Map<string, string | boolean>;
}

export class UsageError extends Error {}

const STRICTNESS = new Set<Strictness>(["relaxed", "standard", "strict", "certified"]);

/** Minimal flag parser: `--json`, `--strictness <level>`, `--base-dir <dir>`. */
export function parseArgs(rest: string[]): Args {
  const positionals: string[] = [];
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i] as string;
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq >= 0) {
        flags.set(a.slice(2, eq), a.slice(eq + 1));
      } else {
        const next = rest[i + 1];
        if (next !== undefined && !next.startsWith("-")) {
          flags.set(a.slice(2), next);
          i++;
        } else {
          flags.set(a.slice(2), true);
        }
      }
    } else {
      positionals.push(a);
    }
  }
  const strictness = String(flags.get("strictness") ?? "standard") as Strictness;
  if (!STRICTNESS.has(strictness)) {
    throw new UsageError(
      `unknown strictness "${strictness}" (relaxed|standard|strict|certified)`,
    );
  }
  return {
    positionals,
    json: flags.get("json") === true || flags.get("json") === "true",
    strictness,
    baseDir: resolve(String(flags.get("base-dir") ?? process.cwd())),
    flags,
  };
}

/** A flag's string value, or `undefined` when absent or value-less. */
export function flagString(args: Args, name: string): string | undefined {
  const value = args.flags.get(name);
  return typeof value === "string" ? value : undefined;
}

/**
 * Args for spec resolution in commands whose positionals are not the spec
 * path: an explicit `--spec <path>` wins, else the base-dir spec is discovered.
 */
export function specArgs(args: Args): Args {
  const override = flagString(args, "spec");
  return { ...args, positionals: override !== undefined ? [override] : [] };
}

/**
 * Resolve the spec governing the base directory: an explicit positional path
 * or `--spec`, otherwise the nearest spec walking up from `baseDir` to the
 * repository boundary (REQ-CORE-SPEC-DISCOVERY, via `@rqml/core`). A directory
 * holding several `*.rqml` and no `requirements.rqml` is reported as ambiguous
 * rather than guessed. The `.rqml/` governance folder is never the spec.
 *
 * `--spec` is honoured here, not only by the commands whose positional is an
 * artifact id (REQ-CLI-SAFE-INVOCATION). It used to be read solely via
 * `specArgs`, so `rqml validate --spec other.rqml` silently validated the
 * *discovered* spec and reported success for a file it never opened — a
 * validator's worst failure mode, and indistinguishable from a real pass.
 * A flag that names the document a command operates on must either take
 * effect or be refused; it must never be dropped.
 */
export function resolveSpecPath(args: Args): string {
  const viaFlag = flagString(args, "spec");
  const positional = args.positionals[0];
  if (viaFlag !== undefined && positional !== undefined) {
    // `specArgs` funnels --spec into the positional, so equal values are the
    // normal path for link/show/impact and are not a conflict.
    if (resolve(args.baseDir, viaFlag) !== resolve(args.baseDir, positional)) {
      throw new UsageError(
        `conflicting spec paths: "${positional}" and --spec "${viaFlag}"; pass one`,
      );
    }
  }
  const explicit = positional ?? viaFlag;
  if (explicit !== undefined) {
    const p = resolve(args.baseDir, explicit);
    if (!existsSync(p)) throw new UsageError(`spec file not found: ${explicit}`);
    if (statSync(p).isDirectory()) {
      throw new UsageError(`"${explicit}" is a directory, not an .rqml file`);
    }
    return p;
  }
  const found = resolveGoverningSpec(args.baseDir);
  if (found.kind === "resolved") return found.specPath;
  if (found.kind === "ambiguous") {
    throw new UsageError(
      `multiple .rqml documents in ${found.dir} and no requirements.rqml ` +
        `(${found.candidates.join(", ")}); rename one to requirements.rqml or pass a path`,
    );
  }
  throw new UsageError(
    "no .rqml document found in this directory or its parents; pass a path",
  );
}

/** True when workspace fan-out is requested (`--workspace` / `--all`). */
export function isWorkspace(args: Args): boolean {
  const w = args.flags.get("workspace");
  const a = args.flags.get("all");
  return w === true || w === "true" || a === true || a === "true";
}

export function readSpec(args: Args): { path: string; xml: string } {
  const path = resolveSpecPath(args);
  return { path, xml: readFileSync(path, "utf8") };
}
