/**
 * Typed model mirroring the RQML schema.
 *
 * Every section of the canonical 2.1.0 schema is modeled: meta, catalogs,
 * domain, goals, scenarios, requirements, behavior, interfaces, verification,
 * trace, and governance. Optional sections and fields are `?`-typed and omitted
 * (never set to `undefined`) so that parse → serialize → parse round-trips
 * preserve model equality. Mixed-content prose (TextBlockType) is modeled as a
 * plain string; markup fidelity inside prose is a documented follow-up.
 */

export type ReqStatus = "draft" | "review" | "approved" | "deprecated";
export type Priority = "must" | "should" | "may";
export type ReqType =
  | "FR"
  | "NFR"
  | "IR"
  | "DR"
  | "SR"
  | "CR"
  | "PR"
  | "UXR"
  | "OR";

export type TraceType =
  | "refines"
  | "satisfies"
  | "dependsOn"
  | "conflictsWith"
  | "threatens"
  | "mitigates"
  | "verifiedBy"
  | "covers"
  | "implements"
  | "supersedes"
  | "consumesInterface"
  | "providesInterface"
  | "conformsTo"
  | "deprecates"
  | "breaks";

export type TestType =
  | "acceptance"
  | "integration"
  | "unit"
  | "security"
  | "performance"
  | "inspection";

export type StateKind = "initial" | "normal" | "final";

// ---------------------------------------------------------------------------
// meta
// ---------------------------------------------------------------------------

export interface Author {
  name: string;
  role?: string;
  org?: string;
  contact?: string;
}

export interface Dates {
  created?: string;
  updated?: string;
  targetRelease?: string;
}

export interface Conventions {
  normativeKeywords?: string;
  idConventions?: string;
}

export interface Profile {
  id: string;
  type: string;
  description?: string;
}

export interface Meta {
  title: string;
  system: string;
  summary?: string;
  authors: Author[];
  dates?: Dates;
  conventions?: Conventions;
  profiles?: Profile[];
}

// ---------------------------------------------------------------------------
// catalogs
// ---------------------------------------------------------------------------

export interface Term {
  id: string;
  name: string;
  definition: string;
  synonyms?: string[];
}

export interface Actor {
  id: string;
  name: string;
  type?: string;
  description?: string;
  /** 2.0.1 only: `<goals><ref ref="…"/></goals>`. Dropped in 2.1.0. */
  goalRefs?: string[];
}

export interface Stakeholder {
  id: string;
  name: string;
  org?: string;
  concerns?: string;
}

export interface Constraint {
  id: string;
  severity?: string;
  statement: string;
  source?: string;
}

export interface Policy {
  id: string;
  source?: string;
  obligation: string;
  evidence?: string;
}

export interface Decision {
  id: string;
  status?: ReqStatus;
  context: string;
  decision: string;
  alternatives?: string;
  consequences?: string;
}

export interface Risk {
  id: string;
  severity?: string;
  statement: string;
  mitigation?: string;
}

export interface Catalogs {
  glossary?: Term[];
  actors?: Actor[];
  stakeholders?: Stakeholder[];
  constraints?: Constraint[];
  policies?: Policy[];
  decisions?: Decision[];
  risks?: Risk[];
}

// ---------------------------------------------------------------------------
// domain
// ---------------------------------------------------------------------------

export interface Attribute {
  id: string;
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  constraints?: string;
}

export interface Entity {
  id: string;
  name: string;
  description?: string;
  attrs?: Attribute[];
}

export interface BusinessRule {
  id: string;
  statement: string;
  examples?: string;
}

export interface Domain {
  overview?: string;
  entities?: Entity[];
  businessRules?: BusinessRule[];
}

// ---------------------------------------------------------------------------
// goals
// ---------------------------------------------------------------------------

export interface Goal {
  id: string;
  title: string;
  priority?: Priority;
  status?: ReqStatus;
  ownerRef?: string;
  statement: string;
  rationale?: string;
}

export interface QualityGoal {
  id: string;
  title: string;
  priority?: Priority;
  status?: ReqStatus;
  statement: string;
  metric?: string;
}

export interface Obstacle {
  id: string;
  title: string;
  likelihood?: string;
  severity?: string;
  statement: string;
  mitigation?: string;
}

export interface GoalLink {
  id: string;
  from: string;
  to: string;
  type: TraceType;
  confidence?: number;
}

export interface Goals {
  goals?: Goal[];
  qualityGoals?: QualityGoal[];
  obstacles?: Obstacle[];
  goalLinks?: GoalLink[];
}

// ---------------------------------------------------------------------------
// scenarios
// ---------------------------------------------------------------------------

export interface Scenario {
  id: string;
  title: string;
  actorRef?: string;
  narrative: string;
}

export interface Scenarios {
  scenarios?: Scenario[];
  misuseCases?: Scenario[];
  edgeCases?: Scenario[];
}

// ---------------------------------------------------------------------------
// requirements
// ---------------------------------------------------------------------------

export interface Criterion {
  id?: string;
  given?: string;
  when?: string;
  then: string;
}

export interface Requirement {
  id: string;
  type: ReqType;
  title: string;
  status?: ReqStatus;
  priority?: Priority;
  ownerRef?: string;
  appliesTo?: string;
  statement: string;
  rationale?: string;
  notes?: string;
  acceptance: Criterion[];
}

export interface RequirementPackage {
  id: string;
  title: string;
  ownerRef?: string;
  description?: string;
  requirements: Requirement[];
}

// ---------------------------------------------------------------------------
// behavior
// ---------------------------------------------------------------------------

export interface State {
  id: string;
  name: string;
  /** Omitted when absent; the XSD default "normal" is never materialized. */
  type?: StateKind;
  description?: string;
  onEntry?: string;
  onExit?: string;
  invariant?: string;
}

export interface Transition {
  id: string;
  from: string;
  to: string;
  event?: string;
  description?: string;
  trigger?: string;
  guard?: string;
  action?: string;
}

export interface StateMachine {
  id: string;
  name: string;
  initial: string;
  entityRef?: string;
  description?: string;
  states: State[];
  transitions?: Transition[];
}

export interface Behavior {
  stateMachines?: StateMachine[];
}

// ---------------------------------------------------------------------------
// interfaces
// ---------------------------------------------------------------------------

export interface Endpoint {
  id: string;
  method: string;
  path: string;
  summary?: string;
  request?: string;
  response?: string;
  errors?: string;
}

export interface Api {
  id: string;
  name: string;
  protocol?: string;
  auth?: string;
  description?: string;
  endpoints?: Endpoint[];
}

/** RQML `<event>` under `<interfaces>`. Named to avoid colliding with DOM Event. */
export interface ApiEvent {
  id: string;
  name: string;
  description?: string;
  payload?: string;
}

export interface Interfaces {
  apis?: Api[];
  events?: ApiEvent[];
}

// ---------------------------------------------------------------------------
// verification
// ---------------------------------------------------------------------------

export interface TestSuite {
  id: string;
  title: string;
  description?: string;
}

export interface TestCase {
  id: string;
  type: TestType;
  title: string;
  purpose?: string;
  steps?: string;
  expected?: string;
}

export interface Verification {
  testSuites?: TestSuite[];
  testCases?: TestCase[];
}

// ---------------------------------------------------------------------------
// trace
// ---------------------------------------------------------------------------

/** A trace endpoint that points at an element in this document by id. */
export interface LocalLocator {
  kind: "local";
  id: string;
  /** Optional schema hint (`@kind`) about the referenced element's category. */
  hintKind?: string;
  title?: string;
}

/** A trace endpoint pointing at another RQML document. */
export interface DocLocator {
  kind: "doc";
  uri: string;
  id: string;
  docId?: string;
  version?: string;
  git?: string;
  hintKind?: string;
  title?: string;
}

/** A trace endpoint pointing at any external artifact by URI. */
export interface ExternalLocator {
  kind: "external";
  uri: string;
  hintKind?: string;
  title?: string;
}

export type Locator = LocalLocator | DocLocator | ExternalLocator;

export interface TraceEdge {
  id: string;
  type: TraceType;
  from: Locator;
  to: Locator;
  confidence?: number;
  status?: ReqStatus;
  createdBy?: string;
  createdAt?: string;
  tags?: string[];
  notes?: string;
}

// ---------------------------------------------------------------------------
// governance
// ---------------------------------------------------------------------------

export interface Issue {
  id: string;
  status?: string;
  owner?: string;
  statement: string;
  notes?: string;
}

export interface Approval {
  id: string;
  role: string;
  status?: string;
  description?: string;
}

export interface Governance {
  issues?: Issue[];
  approvals?: Approval[];
}

// ---------------------------------------------------------------------------
// document
// ---------------------------------------------------------------------------

/**
 * The fully-typed model of a parsed `.rqml` document — the central type of the
 * library, produced by {@link parse} and consumed by {@link serialize},
 * {@link lint}, {@link resolveTrace}, and {@link buildOutline}.
 *
 * It covers all eleven RQML sections. `meta`, `packages`/`looseRequirements`,
 * and `trace` are always present (possibly empty); the other sections are
 * optional and omitted entirely when absent, so a round-trip through
 * {@link serialize} reproduces a minimal document rather than empty shells.
 */
export interface RqmlDocument {
  version: string;
  docId: string;
  status: ReqStatus;
  meta: Meta;
  catalogs?: Catalogs;
  domain?: Domain;
  goals?: Goals;
  scenarios?: Scenarios;
  /** Requirements grouped into packages. */
  packages: RequirementPackage[];
  /** Requirements declared directly under `<requirements>` (not in a package). */
  looseRequirements: Requirement[];
  behavior?: Behavior;
  interfaces?: Interfaces;
  verification?: Verification;
  trace: TraceEdge[];
  governance?: Governance;
}

/** Convenience: every requirement in the document, regardless of grouping. */
export function allRequirements(doc: RqmlDocument): Requirement[] {
  return [
    ...doc.packages.flatMap((p) => p.requirements),
    ...doc.looseRequirements,
  ];
}

/** A reference to any id-bearing element, tagged with its element kind. */
export interface ElementRef {
  id: string;
  kind: string;
}

/**
 * Every id-bearing element across all sections, in document order. Drives the
 * generalized trace index so edges to non-requirement targets (goals, risks,
 * states, tests, …) resolve correctly.
 */
export function declaredElements(doc: RqmlDocument): ElementRef[] {
  const out: ElementRef[] = [];
  const push = (id: string | undefined, kind: string): void => {
    if (id !== undefined) out.push({ id, kind });
  };

  for (const p of doc.meta.profiles ?? []) push(p.id, "profile");

  const c = doc.catalogs;
  if (c) {
    for (const t of c.glossary ?? []) push(t.id, "term");
    for (const a of c.actors ?? []) push(a.id, "actor");
    for (const s of c.stakeholders ?? []) push(s.id, "stakeholder");
    for (const x of c.constraints ?? []) push(x.id, "constraint");
    for (const x of c.policies ?? []) push(x.id, "policy");
    for (const x of c.decisions ?? []) push(x.id, "decision");
    for (const x of c.risks ?? []) push(x.id, "risk");
  }

  const d = doc.domain;
  if (d) {
    for (const e of d.entities ?? []) {
      push(e.id, "entity");
      for (const a of e.attrs ?? []) push(a.id, "attr");
    }
    for (const r of d.businessRules ?? []) push(r.id, "rule");
  }

  const g = doc.goals;
  if (g) {
    for (const x of g.goals ?? []) push(x.id, "goal");
    for (const x of g.qualityGoals ?? []) push(x.id, "qgoal");
    for (const x of g.obstacles ?? []) push(x.id, "obstacle");
    for (const x of g.goalLinks ?? []) push(x.id, "goalLink");
  }

  const sc = doc.scenarios;
  if (sc) {
    for (const x of sc.scenarios ?? []) push(x.id, "scenario");
    for (const x of sc.misuseCases ?? []) push(x.id, "misuseCase");
    for (const x of sc.edgeCases ?? []) push(x.id, "edgeCase");
  }

  for (const p of doc.packages) {
    push(p.id, "reqPackage");
    for (const r of p.requirements) {
      push(r.id, "req");
      for (const cr of r.acceptance) push(cr.id, "criterion");
    }
  }
  for (const r of doc.looseRequirements) {
    push(r.id, "req");
    for (const cr of r.acceptance) push(cr.id, "criterion");
  }

  const b = doc.behavior;
  if (b) {
    for (const sm of b.stateMachines ?? []) {
      push(sm.id, "stateMachine");
      for (const st of sm.states) push(st.id, "state");
      for (const tr of sm.transitions ?? []) push(tr.id, "transition");
    }
  }

  const it = doc.interfaces;
  if (it) {
    for (const api of it.apis ?? []) {
      push(api.id, "api");
      for (const ep of api.endpoints ?? []) push(ep.id, "endpoint");
    }
    for (const ev of it.events ?? []) push(ev.id, "event");
  }

  const v = doc.verification;
  if (v) {
    for (const ts of v.testSuites ?? []) push(ts.id, "testSuite");
    for (const tc of v.testCases ?? []) push(tc.id, "testCase");
  }

  for (const e of doc.trace) push(e.id, "edge");

  const gv = doc.governance;
  if (gv) {
    for (const x of gv.issues ?? []) push(x.id, "issue");
    for (const x of gv.approvals ?? []) push(x.id, "approval");
  }

  return out;
}
