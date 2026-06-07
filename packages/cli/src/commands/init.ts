import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { AGENTS_TEMPLATE } from "@rqml/schema";
import { EXIT, parseArgs } from "../runtime.js";

const STARTER_SPEC = `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="PROJECT-001" status="draft">
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

/** `rqml init` — scaffold a starter spec and the AGENTS.md project marker. */
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

  if (existsSync(agentsPath)) {
    process.stdout.write(`skip (exists) ${agentsPath}\n`);
  } else {
    writeFileSync(agentsPath, AGENTS_TEMPLATE);
    process.stdout.write(`created ${agentsPath}\n`);
    wrote = true;
  }

  if (!wrote) process.stdout.write("nothing to do; project already initialized\n");
  return EXIT.OK;
}
