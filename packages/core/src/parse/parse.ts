import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { Diagnostic } from "../model/diagnostic.js";
import type {
  Actor,
  Api,
  ApiEvent,
  Approval,
  Attribute,
  Author,
  Behavior,
  BusinessRule,
  Catalogs,
  Constraint,
  Conventions,
  Criterion,
  Dates,
  Decision,
  DocLocator,
  Domain,
  Endpoint,
  Entity,
  ExternalLocator,
  Goal,
  GoalLink,
  Goals,
  Governance,
  Interfaces,
  Issue,
  LocalLocator,
  Locator,
  Meta,
  Obstacle,
  Policy,
  Priority,
  Profile,
  QualityGoal,
  ReqStatus,
  ReqType,
  Requirement,
  RequirementPackage,
  Risk,
  RqmlDocument,
  Scenario,
  Scenarios,
  Stakeholder,
  State,
  StateKind,
  StateMachine,
  Term,
  TestCase,
  TestSuite,
  TestType,
  TraceEdge,
  TraceType,
  Transition,
  Verification,
} from "../model/types.js";
import { setRawSections } from "./raw.js";

export type ParseResult =
  | { ok: true; document: RqmlDocument }
  | { ok: false; error: Diagnostic };

const ATTR_PREFIX = "@_";

/**
 * Tags that may legitimately repeat and so must always parse to arrays.
 *
 * Note: `decision` is intentionally omitted. The element name is used both as a
 * repeatable container child (`<decisions><decision/></decisions>`) and as a
 * leaf text element (`<decision><decision>…</decision></decision>`); forcing it
 * to an array would break reading the leaf. `asArray`/`collect` normalize the
 * container occurrences instead.
 */
const ARRAY_TAGS = new Set([
  "author",
  "profile",
  "term",
  "synonym",
  "actor",
  "stakeholder",
  "constraint",
  "policy",
  "risk",
  "ref",
  "entity",
  "attr",
  "rule",
  "goal",
  "qgoal",
  "obstacle",
  "goalLink",
  "scenario",
  "misuseCase",
  "edgeCase",
  "stateMachine",
  "state",
  "transition",
  "api",
  "endpoint",
  "event",
  "testSuite",
  "testCase",
  "reqPackage",
  "req",
  "criterion",
  "edge",
  "traceEdge",
  "issue",
  "approval",
]);

/** Top-level sections this model maps. Anything else is kept in the raw stash. */
const MODELED_SECTIONS = new Set([
  "meta",
  "catalogs",
  "domain",
  "goals",
  "scenarios",
  "requirements",
  "behavior",
  "interfaces",
  "verification",
  "trace",
  "governance",
]);

/** Root attributes the serializer reconstructs from the model/defaults. */
const KNOWN_ROOT_ATTRS = new Set([
  "@_xmlns",
  "@_xmlns:xsi",
  "@_xsi:schemaLocation",
  "@_version",
  "@_docId",
  "@_status",
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: ATTR_PREFIX,
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => ARRAY_TAGS.has(name),
});

type Node = Record<string, unknown>;

function isNode(v: unknown): v is Node {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function child(node: unknown, name: string): unknown {
  return isNode(node) ? node[name] : undefined;
}

function attr(node: unknown, name: string): string | undefined {
  if (!isNode(node)) return undefined;
  const v = node[ATTR_PREFIX + name];
  return v == null ? undefined : String(v);
}

function numAttr(node: unknown, name: string): number | undefined {
  const v = attr(node, name);
  return v === undefined ? undefined : Number(v);
}

function boolAttr(node: unknown, name: string): boolean | undefined {
  const v = attr(node, name);
  if (v === undefined) return undefined;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return undefined;
}

/** Extract the text content of an element node (string, or { '#text': ... }). */
function text(node: unknown): string | undefined {
  if (node == null) return undefined;
  if (typeof node === "string") return node;
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (isNode(node)) {
    const t = node["#text"];
    return t == null ? undefined : String(t);
  }
  return undefined;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Collect the `childName` children across one or more container occurrences.
 * Handles a single container node, an array of containers (a repeated schema
 * choice), or an absent container.
 */
function collect(container: unknown, childName: string): unknown[] {
  return asArray(container).flatMap((c) => asArray(child(c, childName)));
}

// ---------------------------------------------------------------------------
// meta
// ---------------------------------------------------------------------------

function parseAuthor(node: unknown): Author {
  const a: Author = { name: text(child(node, "name")) ?? "" };
  const role = text(child(node, "role"));
  const org = text(child(node, "org"));
  const contact = text(child(node, "contact"));
  if (role !== undefined) a.role = role;
  if (org !== undefined) a.org = org;
  if (contact !== undefined) a.contact = contact;
  return a;
}

function parseProfile(node: unknown): Profile {
  const p: Profile = {
    id: attr(node, "id") ?? "",
    type: attr(node, "type") ?? "",
  };
  const description = text(child(node, "description"));
  if (description !== undefined) p.description = description;
  return p;
}

function parseMeta(node: unknown): Meta {
  const meta: Meta = {
    title: text(child(node, "title")) ?? "",
    system: text(child(node, "system")) ?? "",
    authors: [],
  };
  const summary = text(child(node, "summary"));
  if (summary !== undefined) meta.summary = summary;
  meta.authors = asArray(child(child(node, "authors"), "author")).map(
    parseAuthor,
  );

  const datesNode = child(node, "dates");
  if (isNode(datesNode)) {
    const dates: Dates = {};
    const created = text(datesNode.created);
    const updated = text(datesNode.updated);
    const targetRelease = text(datesNode.targetRelease);
    if (created !== undefined) dates.created = created;
    if (updated !== undefined) dates.updated = updated;
    if (targetRelease !== undefined) dates.targetRelease = targetRelease;
    if (Object.keys(dates).length > 0) meta.dates = dates;
  }

  const convNode = child(node, "conventions");
  if (isNode(convNode)) {
    const conv: Conventions = {};
    const nk = text(convNode.normativeKeywords);
    const ic = text(convNode.idConventions);
    if (nk !== undefined) conv.normativeKeywords = nk;
    if (ic !== undefined) conv.idConventions = ic;
    if (Object.keys(conv).length > 0) meta.conventions = conv;
  }

  const profiles = asArray(child(child(node, "profiles"), "profile")).map(
    parseProfile,
  );
  if (profiles.length > 0) meta.profiles = profiles;

  return meta;
}

// ---------------------------------------------------------------------------
// catalogs
// ---------------------------------------------------------------------------

function parseTerm(node: unknown): Term {
  const t: Term = {
    id: attr(node, "id") ?? "",
    name: text(child(node, "name")) ?? "",
    definition: text(child(node, "definition")) ?? "",
  };
  const synonyms = asArray(child(child(node, "synonyms"), "synonym")).map(
    (s) => text(s) ?? "",
  );
  if (synonyms.length > 0) t.synonyms = synonyms;
  return t;
}

function parseActor(node: unknown): Actor {
  const a: Actor = { id: attr(node, "id") ?? "", name: attr(node, "name") ?? "" };
  const type = attr(node, "type");
  const description = text(child(node, "description"));
  if (type !== undefined) a.type = type;
  if (description !== undefined) a.description = description;
  const refs = asArray(child(child(node, "goals"), "ref")).map(
    (r) => attr(r, "ref") ?? "",
  );
  if (refs.length > 0) a.goalRefs = refs;
  return a;
}

function parseStakeholder(node: unknown): Stakeholder {
  const s: Stakeholder = {
    id: attr(node, "id") ?? "",
    name: attr(node, "name") ?? "",
  };
  const org = attr(node, "org");
  const concerns = text(child(node, "concerns"));
  if (org !== undefined) s.org = org;
  if (concerns !== undefined) s.concerns = concerns;
  return s;
}

function parseConstraint(node: unknown): Constraint {
  const c: Constraint = {
    id: attr(node, "id") ?? "",
    statement: text(child(node, "statement")) ?? "",
  };
  const severity = attr(node, "severity");
  const source = text(child(node, "source"));
  if (severity !== undefined) c.severity = severity;
  if (source !== undefined) c.source = source;
  return c;
}

function parsePolicy(node: unknown): Policy {
  const p: Policy = {
    id: attr(node, "id") ?? "",
    obligation: text(child(node, "obligation")) ?? "",
  };
  const source = attr(node, "source");
  const evidence = text(child(node, "evidence"));
  if (source !== undefined) p.source = source;
  if (evidence !== undefined) p.evidence = evidence;
  return p;
}

function parseDecision(node: unknown): Decision {
  const d: Decision = {
    id: attr(node, "id") ?? "",
    context: text(child(node, "context")) ?? "",
    decision: text(child(node, "decision")) ?? "",
  };
  const status = attr(node, "status") as ReqStatus | undefined;
  const alternatives = text(child(node, "alternatives"));
  const consequences = text(child(node, "consequences"));
  if (status !== undefined) d.status = status;
  if (alternatives !== undefined) d.alternatives = alternatives;
  if (consequences !== undefined) d.consequences = consequences;
  return d;
}

function parseRisk(node: unknown): Risk {
  const r: Risk = {
    id: attr(node, "id") ?? "",
    statement: text(child(node, "statement")) ?? "",
  };
  const severity = attr(node, "severity");
  const mitigation = text(child(node, "mitigation"));
  if (severity !== undefined) r.severity = severity;
  if (mitigation !== undefined) r.mitigation = mitigation;
  return r;
}

function parseCatalogs(node: unknown): Catalogs | undefined {
  if (!isNode(node)) return undefined;
  const c: Catalogs = {};
  const glossary = collect(node.glossary, "term").map(parseTerm);
  const actors = collect(node.actors, "actor").map(parseActor);
  const stakeholders = collect(node.stakeholders, "stakeholder").map(
    parseStakeholder,
  );
  const constraints = collect(node.constraints, "constraint").map(
    parseConstraint,
  );
  const policies = collect(node.policies, "policy").map(parsePolicy);
  const decisions = collect(node.decisions, "decision").map(parseDecision);
  const risks = collect(node.risks, "risk").map(parseRisk);
  if (glossary.length > 0) c.glossary = glossary;
  if (actors.length > 0) c.actors = actors;
  if (stakeholders.length > 0) c.stakeholders = stakeholders;
  if (constraints.length > 0) c.constraints = constraints;
  if (policies.length > 0) c.policies = policies;
  if (decisions.length > 0) c.decisions = decisions;
  if (risks.length > 0) c.risks = risks;
  return Object.keys(c).length > 0 ? c : undefined;
}

// ---------------------------------------------------------------------------
// domain
// ---------------------------------------------------------------------------

function parseAttribute(node: unknown): Attribute {
  const a: Attribute = {
    id: attr(node, "id") ?? "",
    name: attr(node, "name") ?? "",
    type: attr(node, "type") ?? "",
  };
  const required = boolAttr(node, "required");
  const description = text(child(node, "description"));
  const constraints = text(child(node, "constraints"));
  if (required !== undefined) a.required = required;
  if (description !== undefined) a.description = description;
  if (constraints !== undefined) a.constraints = constraints;
  return a;
}

function parseEntity(node: unknown): Entity {
  const e: Entity = { id: attr(node, "id") ?? "", name: attr(node, "name") ?? "" };
  const description = text(child(node, "description"));
  if (description !== undefined) e.description = description;
  const attrs = asArray(child(node, "attr")).map(parseAttribute);
  if (attrs.length > 0) e.attrs = attrs;
  return e;
}

function parseBusinessRule(node: unknown): BusinessRule {
  const r: BusinessRule = {
    id: attr(node, "id") ?? "",
    statement: text(child(node, "statement")) ?? "",
  };
  const examples = text(child(node, "examples"));
  if (examples !== undefined) r.examples = examples;
  return r;
}

function parseDomain(node: unknown): Domain | undefined {
  if (!isNode(node)) return undefined;
  const d: Domain = {};
  const overview = text(child(node, "overview"));
  if (overview !== undefined) d.overview = overview;
  const entities = collect(node.entities, "entity").map(parseEntity);
  const rules = collect(node.businessRules, "rule").map(parseBusinessRule);
  if (entities.length > 0) d.entities = entities;
  if (rules.length > 0) d.businessRules = rules;
  return Object.keys(d).length > 0 ? d : undefined;
}

// ---------------------------------------------------------------------------
// goals
// ---------------------------------------------------------------------------

function parseGoal(node: unknown): Goal {
  const g: Goal = {
    id: attr(node, "id") ?? "",
    title: attr(node, "title") ?? "",
    statement: text(child(node, "statement")) ?? "",
  };
  const priority = attr(node, "priority") as Priority | undefined;
  const status = attr(node, "status") as ReqStatus | undefined;
  const ownerRef = attr(node, "ownerRef");
  const rationale = text(child(node, "rationale"));
  if (priority !== undefined) g.priority = priority;
  if (status !== undefined) g.status = status;
  if (ownerRef !== undefined) g.ownerRef = ownerRef;
  if (rationale !== undefined) g.rationale = rationale;
  return g;
}

function parseQualityGoal(node: unknown): QualityGoal {
  const q: QualityGoal = {
    id: attr(node, "id") ?? "",
    title: attr(node, "title") ?? "",
    statement: text(child(node, "statement")) ?? "",
  };
  const priority = attr(node, "priority") as Priority | undefined;
  const status = attr(node, "status") as ReqStatus | undefined;
  const metric = text(child(node, "metric"));
  if (priority !== undefined) q.priority = priority;
  if (status !== undefined) q.status = status;
  if (metric !== undefined) q.metric = metric;
  return q;
}

function parseObstacle(node: unknown): Obstacle {
  const o: Obstacle = {
    id: attr(node, "id") ?? "",
    title: attr(node, "title") ?? "",
    statement: text(child(node, "statement")) ?? "",
  };
  const likelihood = attr(node, "likelihood");
  const severity = attr(node, "severity");
  const mitigation = text(child(node, "mitigation"));
  if (likelihood !== undefined) o.likelihood = likelihood;
  if (severity !== undefined) o.severity = severity;
  if (mitigation !== undefined) o.mitigation = mitigation;
  return o;
}

function parseGoalLink(node: unknown): GoalLink {
  const gl: GoalLink = {
    id: attr(node, "id") ?? "",
    from: attr(node, "from") ?? "",
    to: attr(node, "to") ?? "",
    type: (attr(node, "type") ?? "refines") as TraceType,
  };
  const confidence = numAttr(node, "confidence");
  if (confidence !== undefined) gl.confidence = confidence;
  return gl;
}

function parseGoals(node: unknown): Goals | undefined {
  if (!isNode(node)) return undefined;
  const g: Goals = {};
  const goals = asArray(node.goal).map(parseGoal);
  const qgoals = asArray(node.qgoal).map(parseQualityGoal);
  const obstacles = asArray(node.obstacle).map(parseObstacle);
  const goalLinks = asArray(node.goalLink).map(parseGoalLink);
  if (goals.length > 0) g.goals = goals;
  if (qgoals.length > 0) g.qualityGoals = qgoals;
  if (obstacles.length > 0) g.obstacles = obstacles;
  if (goalLinks.length > 0) g.goalLinks = goalLinks;
  return Object.keys(g).length > 0 ? g : undefined;
}

// ---------------------------------------------------------------------------
// scenarios
// ---------------------------------------------------------------------------

function parseScenario(node: unknown): Scenario {
  const s: Scenario = {
    id: attr(node, "id") ?? "",
    title: attr(node, "title") ?? "",
    narrative: text(child(node, "narrative")) ?? "",
  };
  const actorRef = attr(node, "actorRef");
  if (actorRef !== undefined) s.actorRef = actorRef;
  return s;
}

function parseScenarios(node: unknown): Scenarios | undefined {
  if (!isNode(node)) return undefined;
  const s: Scenarios = {};
  const scenarios = asArray(node.scenario).map(parseScenario);
  const misuseCases = asArray(node.misuseCase).map(parseScenario);
  const edgeCases = asArray(node.edgeCase).map(parseScenario);
  if (scenarios.length > 0) s.scenarios = scenarios;
  if (misuseCases.length > 0) s.misuseCases = misuseCases;
  if (edgeCases.length > 0) s.edgeCases = edgeCases;
  return Object.keys(s).length > 0 ? s : undefined;
}

// ---------------------------------------------------------------------------
// requirements
// ---------------------------------------------------------------------------

function parseCriterion(node: unknown): Criterion {
  const crit: Criterion = { then: text(child(node, "then")) ?? "" };
  const id = attr(node, "id");
  const given = text(child(node, "given"));
  const when = text(child(node, "when"));
  if (id !== undefined) crit.id = id;
  if (given !== undefined) crit.given = given;
  if (when !== undefined) crit.when = when;
  return crit;
}

function parseRequirement(node: unknown): Requirement {
  const req: Requirement = {
    id: attr(node, "id") ?? "",
    type: (attr(node, "type") ?? "FR") as ReqType,
    title: attr(node, "title") ?? "",
    statement: text(child(node, "statement")) ?? "",
    acceptance: [],
  };
  const status = attr(node, "status") as ReqStatus | undefined;
  const priority = attr(node, "priority") as Priority | undefined;
  const ownerRef = attr(node, "ownerRef");
  const appliesTo = attr(node, "appliesTo");
  const rationale = text(child(node, "rationale"));
  const notes = text(child(node, "notes"));
  if (status !== undefined) req.status = status;
  if (priority !== undefined) req.priority = priority;
  if (ownerRef !== undefined) req.ownerRef = ownerRef;
  if (appliesTo !== undefined) req.appliesTo = appliesTo;
  if (rationale !== undefined) req.rationale = rationale;
  if (notes !== undefined) req.notes = notes;

  req.acceptance = asArray(child(child(node, "acceptance"), "criterion")).map(
    parseCriterion,
  );
  return req;
}

function parsePackage(node: unknown): RequirementPackage {
  const pkg: RequirementPackage = {
    id: attr(node, "id") ?? "",
    title: attr(node, "title") ?? "",
    requirements: asArray(child(node, "req")).map(parseRequirement),
  };
  const ownerRef = attr(node, "ownerRef");
  const description = text(child(node, "description"));
  if (ownerRef !== undefined) pkg.ownerRef = ownerRef;
  if (description !== undefined) pkg.description = description;
  return pkg;
}

// ---------------------------------------------------------------------------
// behavior
// ---------------------------------------------------------------------------

function parseState(node: unknown): State {
  const st: State = { id: attr(node, "id") ?? "", name: attr(node, "name") ?? "" };
  const type = attr(node, "type") as StateKind | undefined;
  const description = text(child(node, "description"));
  const onEntry = text(child(node, "onEntry"));
  const onExit = text(child(node, "onExit"));
  const invariant = text(child(node, "invariant"));
  if (type !== undefined) st.type = type;
  if (description !== undefined) st.description = description;
  if (onEntry !== undefined) st.onEntry = onEntry;
  if (onExit !== undefined) st.onExit = onExit;
  if (invariant !== undefined) st.invariant = invariant;
  return st;
}

function parseTransition(node: unknown): Transition {
  const tr: Transition = {
    id: attr(node, "id") ?? "",
    from: attr(node, "from") ?? "",
    to: attr(node, "to") ?? "",
  };
  const event = attr(node, "event");
  const description = text(child(node, "description"));
  const trigger = text(child(node, "trigger"));
  const guard = text(child(node, "guard"));
  const action = text(child(node, "action"));
  if (event !== undefined) tr.event = event;
  if (description !== undefined) tr.description = description;
  if (trigger !== undefined) tr.trigger = trigger;
  if (guard !== undefined) tr.guard = guard;
  if (action !== undefined) tr.action = action;
  return tr;
}

function parseStateMachine(node: unknown): StateMachine {
  const sm: StateMachine = {
    id: attr(node, "id") ?? "",
    name: attr(node, "name") ?? "",
    initial: attr(node, "initial") ?? "",
    states: asArray(child(node, "state")).map(parseState),
  };
  const entityRef = attr(node, "entityRef");
  const description = text(child(node, "description"));
  if (entityRef !== undefined) sm.entityRef = entityRef;
  if (description !== undefined) sm.description = description;
  const transitions = asArray(child(node, "transition")).map(parseTransition);
  if (transitions.length > 0) sm.transitions = transitions;
  return sm;
}

function parseBehavior(node: unknown): Behavior | undefined {
  if (!isNode(node)) return undefined;
  const stateMachines = asArray(node.stateMachine).map(parseStateMachine);
  return stateMachines.length > 0 ? { stateMachines } : undefined;
}

// ---------------------------------------------------------------------------
// interfaces
// ---------------------------------------------------------------------------

function parseEndpoint(node: unknown): Endpoint {
  const ep: Endpoint = {
    id: attr(node, "id") ?? "",
    method: attr(node, "method") ?? "",
    path: attr(node, "path") ?? "",
  };
  const summary = text(child(node, "summary"));
  const request = text(child(node, "request"));
  const response = text(child(node, "response"));
  const errors = text(child(node, "errors"));
  if (summary !== undefined) ep.summary = summary;
  if (request !== undefined) ep.request = request;
  if (response !== undefined) ep.response = response;
  if (errors !== undefined) ep.errors = errors;
  return ep;
}

function parseApi(node: unknown): Api {
  const api: Api = { id: attr(node, "id") ?? "", name: attr(node, "name") ?? "" };
  const protocol = attr(node, "protocol");
  const auth = attr(node, "auth");
  const description = text(child(node, "description"));
  if (protocol !== undefined) api.protocol = protocol;
  if (auth !== undefined) api.auth = auth;
  if (description !== undefined) api.description = description;
  const endpoints = asArray(child(node, "endpoint")).map(parseEndpoint);
  if (endpoints.length > 0) api.endpoints = endpoints;
  return api;
}

function parseEvent(node: unknown): ApiEvent {
  const ev: ApiEvent = { id: attr(node, "id") ?? "", name: attr(node, "name") ?? "" };
  const description = text(child(node, "description"));
  const payload = text(child(node, "payload"));
  if (description !== undefined) ev.description = description;
  if (payload !== undefined) ev.payload = payload;
  return ev;
}

function parseInterfaces(node: unknown): Interfaces | undefined {
  if (!isNode(node)) return undefined;
  const i: Interfaces = {};
  const apis = asArray(node.api).map(parseApi);
  const events = asArray(node.event).map(parseEvent);
  if (apis.length > 0) i.apis = apis;
  if (events.length > 0) i.events = events;
  return Object.keys(i).length > 0 ? i : undefined;
}

// ---------------------------------------------------------------------------
// verification
// ---------------------------------------------------------------------------

function parseTestSuite(node: unknown): TestSuite {
  const ts: TestSuite = {
    id: attr(node, "id") ?? "",
    title: attr(node, "title") ?? "",
  };
  const description = text(child(node, "description"));
  if (description !== undefined) ts.description = description;
  return ts;
}

function parseTestCase(node: unknown): TestCase {
  const tc: TestCase = {
    id: attr(node, "id") ?? "",
    type: (attr(node, "type") ?? "acceptance") as TestType,
    title: attr(node, "title") ?? "",
  };
  const purpose = text(child(node, "purpose"));
  const steps = text(child(node, "steps"));
  const expected = text(child(node, "expected"));
  if (purpose !== undefined) tc.purpose = purpose;
  if (steps !== undefined) tc.steps = steps;
  if (expected !== undefined) tc.expected = expected;
  return tc;
}

function parseVerification(node: unknown): Verification | undefined {
  if (!isNode(node)) return undefined;
  const v: Verification = {};
  const testSuites = asArray(node.testSuite).map(parseTestSuite);
  const testCases = asArray(node.testCase).map(parseTestCase);
  if (testSuites.length > 0) v.testSuites = testSuites;
  if (testCases.length > 0) v.testCases = testCases;
  return Object.keys(v).length > 0 ? v : undefined;
}

// ---------------------------------------------------------------------------
// trace
// ---------------------------------------------------------------------------

function parseLocator(parent: unknown): Locator | undefined {
  const loc = child(parent, "locator");
  if (!isNode(loc)) return undefined;
  if (isNode(loc.local)) {
    const out: LocalLocator = { kind: "local", id: attr(loc.local, "id") ?? "" };
    const hintKind = attr(loc.local, "kind");
    const title = attr(loc.local, "title");
    if (hintKind !== undefined) out.hintKind = hintKind;
    if (title !== undefined) out.title = title;
    return out;
  }
  if (isNode(loc.doc)) {
    const out: DocLocator = {
      kind: "doc",
      uri: attr(loc.doc, "uri") ?? "",
      id: attr(loc.doc, "id") ?? "",
    };
    const docId = attr(loc.doc, "docId");
    const version = attr(loc.doc, "version");
    const git = attr(loc.doc, "git");
    const hintKind = attr(loc.doc, "kind");
    const title = attr(loc.doc, "title");
    if (docId !== undefined) out.docId = docId;
    if (version !== undefined) out.version = version;
    if (git !== undefined) out.git = git;
    if (hintKind !== undefined) out.hintKind = hintKind;
    if (title !== undefined) out.title = title;
    return out;
  }
  if (isNode(loc.external)) {
    const out: ExternalLocator = {
      kind: "external",
      uri: attr(loc.external, "uri") ?? "",
    };
    const hintKind = attr(loc.external, "kind");
    const title = attr(loc.external, "title");
    if (hintKind !== undefined) out.hintKind = hintKind;
    if (title !== undefined) out.title = title;
    return out;
  }
  return undefined;
}

/** Apply the optional metadata shared by nested and flat trace edges. */
function applyEdgeMeta(edge: TraceEdge, node: unknown): void {
  const confidence = numAttr(node, "confidence");
  const status = attr(node, "status") as ReqStatus | undefined;
  const createdBy = attr(node, "createdBy");
  const createdAt = attr(node, "createdAt");
  const tags = attr(node, "tags");
  const notes = text(child(node, "notes"));
  if (confidence !== undefined) edge.confidence = confidence;
  if (status !== undefined) edge.status = status;
  if (createdBy !== undefined) edge.createdBy = createdBy;
  if (createdAt !== undefined) edge.createdAt = createdAt;
  if (tags !== undefined) {
    const arr = tags.split(/\s+/).filter((t) => t.length > 0);
    if (arr.length > 0) edge.tags = arr;
  }
  if (notes !== undefined) edge.notes = notes;
}

/** Nested 2.1.0 `<edge><from><locator>…</locator></from>…</edge>`. */
function parseEdge(node: unknown): TraceEdge | undefined {
  const from = parseLocator(child(node, "from"));
  const to = parseLocator(child(node, "to"));
  if (!from || !to) return undefined;
  const edge: TraceEdge = {
    id: attr(node, "id") ?? "",
    type: (attr(node, "type") ?? "satisfies") as TraceType,
    from,
    to,
  };
  applyEdgeMeta(edge, node);
  return edge;
}

/** Flat 2.0.1 `<traceEdge from="A" to="B" type="…"/>`. */
function parseFlatEdge(node: unknown): TraceEdge | undefined {
  const fromId = attr(node, "from");
  const toId = attr(node, "to");
  const fromUri = attr(node, "fromUri");
  const toUri = attr(node, "toUri");
  let from: Locator | undefined;
  let to: Locator | undefined;
  if (fromId !== undefined) from = { kind: "local", id: fromId };
  else if (fromUri !== undefined) from = { kind: "external", uri: fromUri };
  if (toId !== undefined) to = { kind: "local", id: toId };
  else if (toUri !== undefined) to = { kind: "external", uri: toUri };
  if (!from || !to) return undefined;
  const edge: TraceEdge = {
    id: attr(node, "id") ?? "",
    type: (attr(node, "type") ?? "satisfies") as TraceType,
    from,
    to,
  };
  applyEdgeMeta(edge, node);
  return edge;
}

/** Read whichever trace serialization is present and normalize to TraceEdge[]. */
function parseTrace(root: Node): TraceEdge[] {
  const traceNode = child(root, "trace");
  if (!isNode(traceNode)) return [];
  const edges: TraceEdge[] = [];
  for (const e of asArray(traceNode.edge)) {
    const parsed = parseEdge(e);
    if (parsed) edges.push(parsed);
  }
  for (const e of asArray(traceNode.traceEdge)) {
    const parsed = parseFlatEdge(e);
    if (parsed) edges.push(parsed);
  }
  return edges;
}

// ---------------------------------------------------------------------------
// governance
// ---------------------------------------------------------------------------

function parseIssue(node: unknown): Issue {
  const iss: Issue = {
    id: attr(node, "id") ?? "",
    statement: text(child(node, "statement")) ?? "",
  };
  const status = attr(node, "status");
  const owner = attr(node, "owner");
  const notes = text(child(node, "notes"));
  if (status !== undefined) iss.status = status;
  if (owner !== undefined) iss.owner = owner;
  if (notes !== undefined) iss.notes = notes;
  return iss;
}

function parseApproval(node: unknown): Approval {
  const ap: Approval = { id: attr(node, "id") ?? "", role: attr(node, "role") ?? "" };
  const status = attr(node, "status");
  const description = text(child(node, "description"));
  if (status !== undefined) ap.status = status;
  if (description !== undefined) ap.description = description;
  return ap;
}

function parseGovernance(node: unknown): Governance | undefined {
  if (!isNode(node)) return undefined;
  const g: Governance = {};
  const issues = asArray(node.issue).map(parseIssue);
  const approvals = asArray(node.approval).map(parseApproval);
  if (issues.length > 0) g.issues = issues;
  if (approvals.length > 0) g.approvals = approvals;
  return Object.keys(g).length > 0 ? g : undefined;
}

// ---------------------------------------------------------------------------
// document
// ---------------------------------------------------------------------------

/**
 * Parse a .rqml document string into a typed model.
 *
 * Returns a structured {@link Diagnostic} instead of throwing when the input
 * is not well-formed XML.
 */
export function parse(xml: string): ParseResult {
  const wellFormed = XMLValidator.validate(xml, { allowBooleanAttributes: true });
  if (wellFormed !== true) {
    const err = wellFormed.err;
    const diag: Diagnostic = {
      source: "parse",
      severity: "error",
      message: err.msg,
    };
    if (typeof err.line === "number") diag.line = err.line;
    if (typeof err.col === "number") diag.column = err.col;
    return { ok: false, error: diag };
  }

  let obj: Node;
  try {
    obj = parser.parse(xml) as Node;
  } catch (e) {
    return {
      ok: false,
      error: {
        source: "parse",
        severity: "error",
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  const root = obj.rqml;
  if (!isNode(root)) {
    return {
      ok: false,
      error: {
        source: "parse",
        severity: "error",
        message: "Missing root <rqml> element.",
      },
    };
  }

  const requirements = isNode(root.requirements) ? root.requirements : {};
  const document: RqmlDocument = {
    version: attr(root, "version") ?? "",
    docId: attr(root, "docId") ?? "",
    status: (attr(root, "status") ?? "draft") as ReqStatus,
    meta: parseMeta(root.meta),
    packages: asArray(requirements.reqPackage).map(parsePackage),
    looseRequirements: asArray(requirements.req).map(parseRequirement),
    trace: parseTrace(root),
  };

  const catalogs = parseCatalogs(root.catalogs);
  if (catalogs) document.catalogs = catalogs;
  const domain = parseDomain(root.domain);
  if (domain) document.domain = domain;
  const goals = parseGoals(root.goals);
  if (goals) document.goals = goals;
  const scenarios = parseScenarios(root.scenarios);
  if (scenarios) document.scenarios = scenarios;
  const behavior = parseBehavior(root.behavior);
  if (behavior) document.behavior = behavior;
  const interfaces = parseInterfaces(root.interfaces);
  if (interfaces) document.interfaces = interfaces;
  const verification = parseVerification(root.verification);
  if (verification) document.verification = verification;
  const governance = parseGovernance(root.governance);
  if (governance) document.governance = governance;

  // Forward-compatibility safety net: retain only unknown root attributes and
  // unknown top-level elements. Known sections and root attributes are fully
  // reconstructed by the serializer from the model.
  const raw: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(root)) {
    if (key.startsWith(ATTR_PREFIX)) {
      if (!KNOWN_ROOT_ATTRS.has(key)) raw[key] = value;
    } else if (!MODELED_SECTIONS.has(key)) {
      raw[key] = value;
    }
  }
  setRawSections(document, raw);

  return { ok: true, document };
}
