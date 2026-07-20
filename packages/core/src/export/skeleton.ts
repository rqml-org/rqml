/**
 * Schema-valid RQML snippet skeletons (REQ-LOOP-SKELETON). Scope is RQML
 * structure only — generation of target-language code or tests is excluded by
 * design (ISS-LOOP-SCOPE); the snippets exist so authoring tools and agents
 * never emit structurally invalid XML.
 */

export type SkeletonKind = "req" | "edge" | "testCase" | "stateMachine";

export const SKELETON_KINDS: readonly SkeletonKind[] = [
  "req",
  "edge",
  "testCase",
  "stateMachine",
];

export interface SkeletonOptions {
  /** Override the placeholder id of the skeleton's root element. */
  id?: string;
}

const TEMPLATES: Record<SkeletonKind, (id: string) => string> = {
  req: (id) => `<req id="${id}" type="FR" title="Title" status="draft" priority="must">
  <statement>The system SHALL ...</statement>
  <acceptance>
    <criterion id="${id}-CRIT-1">
      <given>...</given>
      <when>...</when>
      <then>...</then>
    </criterion>
  </acceptance>
</req>`,
  edge: (id) => `<edge id="${id}" type="satisfies" from="REQ-AREA-001" to="GOAL-NAME"/>`,
  testCase: (id) => `<testCase id="${id}" type="unit" title="Title">
  <purpose>...</purpose>
  <steps>...</steps>
  <expected>...</expected>
</testCase>`,
  stateMachine: (id) => `<stateMachine id="${id}" name="Name" initial="ST-START">
  <state id="ST-START" name="Start" type="initial"/>
  <state id="ST-DONE" name="Done" type="final"/>
  <transition id="TR-FINISH" from="ST-START" to="ST-DONE" event="finish"/>
</stateMachine>`,
};

const DEFAULT_IDS: Record<SkeletonKind, string> = {
  req: "REQ-AREA-001",
  edge: "E-AREA-001",
  testCase: "TC-NAME",
  stateMachine: "SM-NAME",
};

/**
 * Return a schema-valid XML snippet for the given element kind. Inserting the
 * snippet into the matching section of a valid document keeps it XSD-valid
 * (CRIT-SKELETON-VALID); placeholder references (edge endpoints, machine
 * states) still need to be pointed at real ids.
 */
export function skeleton(kind: SkeletonKind, options: SkeletonOptions = {}): string {
  const template = TEMPLATES[kind];
  return `${template(options.id ?? DEFAULT_IDS[kind])}\n`;
}
