import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

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
  };
}

/**
 * Resolve the spec file: an explicit positional path, otherwise the lone
 * `*.rqml` document in the base directory (preferring `requirements.rqml`).
 */
export function resolveSpecPath(args: Args): string {
  const explicit = args.positionals[0];
  if (explicit !== undefined) {
    const p = resolve(args.baseDir, explicit);
    if (!existsSync(p)) throw new UsageError(`spec file not found: ${explicit}`);
    if (statSync(p).isDirectory()) {
      throw new UsageError(`"${explicit}" is a directory, not an .rqml file`);
    }
    return p;
  }
  // Only regular files — a directory whose name ends in ".rqml" (e.g. the
  // project's `.rqml/` governance folder) must not be mistaken for the spec.
  const candidates = readdirSync(args.baseDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".rqml"))
    .map((e) => e.name)
    .sort();
  if (candidates.length === 0) {
    throw new UsageError("no .rqml document found in this directory; pass a path");
  }
  const preferred = candidates.includes("requirements.rqml")
    ? "requirements.rqml"
    : (candidates[0] as string);
  return resolve(args.baseDir, preferred);
}

export function readSpec(args: Args): { path: string; xml: string } {
  const path = resolveSpecPath(args);
  return { path, xml: readFileSync(path, "utf8") };
}
