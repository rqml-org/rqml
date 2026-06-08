import { XMLBuilder } from "fast-xml-parser";
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
  Criterion,
  Decision,
  Domain,
  Endpoint,
  Entity,
  Goal,
  GoalLink,
  Goals,
  Governance,
  Interfaces,
  Issue,
  Locator,
  Meta,
  Obstacle,
  Policy,
  Profile,
  QualityGoal,
  Requirement,
  RequirementPackage,
  Risk,
  RqmlDocument,
  Scenario,
  Scenarios,
  Stakeholder,
  State,
  StateMachine,
  Term,
  TestCase,
  TestSuite,
  TraceEdge,
  Transition,
  Verification,
} from "../model/types.js";
import { getRawSections } from "./raw.js";

const ATTR_PREFIX = "@_";

const XSI = "http://www.w3.org/2001/XMLSchema-instance";
const NS_210 = {
  xmlns: "https://rqml.org/schema/2.1.0",
  schemaLocation: "https://rqml.org/schema/2.1.0 https://rqml.org/schema/rqml-2.1.0.xsd",
};
const NS_201 = {
  xmlns: "https://rqml.org/schema/2.0.1",
  schemaLocation: "https://rqml.org/schema/2.0.1 https://rqml.org/schema/rqml-2.0.1.xsd",
};

function namespaceFor(version: string): { xmlns: string; schemaLocation: string } {
  return version === "2.0.1" ? NS_201 : NS_210;
}

/**
 * Canonical top-level section order (after `<meta>`, around `<requirements>`):
 * meta, catalogs, domain, goals, scenarios, requirements, behavior,
 * interfaces, verification, trace, governance. The assembly below inserts
 * sections in exactly this order so the emitted document is schema-valid.
 */

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: ATTR_PREFIX,
  format: true,
  suppressEmptyNode: true,
  // Keep value="true" attributes intact; otherwise XMLBuilder collapses them to
  // valueless attributes (e.g. `required`), which the parser then drops.
  suppressBooleanAttributes: false,
});

type Obj = Record<string, unknown>;

function setIfDefined(obj: Obj, key: string, value: unknown): void {
  if (value !== undefined && value !== null) obj[key] = value;
}

// ---------------------------------------------------------------------------
// meta
// ---------------------------------------------------------------------------

function buildAuthor(a: Author): Obj {
  const out: Obj = { name: a.name };
  setIfDefined(out, "role", a.role);
  setIfDefined(out, "org", a.org);
  setIfDefined(out, "contact", a.contact);
  return out;
}

function buildProfile(p: Profile): Obj {
  const out: Obj = { "@_id": p.id, "@_type": p.type };
  setIfDefined(out, "description", p.description);
  return out;
}

function buildMeta(meta: Meta): Obj {
  const out: Obj = { title: meta.title, system: meta.system };
  setIfDefined(out, "summary", meta.summary);
  if (meta.authors.length > 0) {
    out.authors = { author: meta.authors.map(buildAuthor) };
  }
  if (meta.dates) {
    const dates: Obj = {};
    setIfDefined(dates, "created", meta.dates.created);
    setIfDefined(dates, "updated", meta.dates.updated);
    setIfDefined(dates, "targetRelease", meta.dates.targetRelease);
    out.dates = dates;
  }
  if (meta.conventions) {
    const conv: Obj = {};
    setIfDefined(conv, "normativeKeywords", meta.conventions.normativeKeywords);
    setIfDefined(conv, "idConventions", meta.conventions.idConventions);
    out.conventions = conv;
  }
  if (meta.profiles && meta.profiles.length > 0) {
    out.profiles = { profile: meta.profiles.map(buildProfile) };
  }
  return out;
}

// ---------------------------------------------------------------------------
// catalogs
// ---------------------------------------------------------------------------

function buildTerm(t: Term): Obj {
  const out: Obj = { "@_id": t.id, name: t.name, definition: t.definition };
  if (t.synonyms && t.synonyms.length > 0) {
    out.synonyms = { synonym: t.synonyms };
  }
  return out;
}

function buildActor(a: Actor): Obj {
  const out: Obj = { "@_id": a.id, "@_name": a.name };
  setIfDefined(out, "@_type", a.type);
  setIfDefined(out, "description", a.description);
  if (a.goalRefs && a.goalRefs.length > 0) {
    out.goals = { ref: a.goalRefs.map((r) => ({ "@_ref": r })) };
  }
  return out;
}

function buildStakeholder(s: Stakeholder): Obj {
  const out: Obj = { "@_id": s.id, "@_name": s.name };
  setIfDefined(out, "@_org", s.org);
  setIfDefined(out, "concerns", s.concerns);
  return out;
}

function buildConstraint(c: Constraint): Obj {
  const out: Obj = { "@_id": c.id };
  setIfDefined(out, "@_severity", c.severity);
  out.statement = c.statement;
  setIfDefined(out, "source", c.source);
  return out;
}

function buildPolicy(p: Policy): Obj {
  const out: Obj = { "@_id": p.id };
  setIfDefined(out, "@_source", p.source);
  out.obligation = p.obligation;
  setIfDefined(out, "evidence", p.evidence);
  return out;
}

function buildDecision(d: Decision): Obj {
  const out: Obj = { "@_id": d.id };
  setIfDefined(out, "@_status", d.status);
  out.context = d.context;
  out.decision = d.decision;
  setIfDefined(out, "alternatives", d.alternatives);
  setIfDefined(out, "consequences", d.consequences);
  return out;
}

function buildRisk(r: Risk): Obj {
  const out: Obj = { "@_id": r.id };
  setIfDefined(out, "@_severity", r.severity);
  out.statement = r.statement;
  setIfDefined(out, "mitigation", r.mitigation);
  return out;
}

function buildCatalogs(c: Catalogs): Obj {
  const out: Obj = {};
  if (c.glossary && c.glossary.length > 0) {
    out.glossary = { term: c.glossary.map(buildTerm) };
  }
  if (c.actors && c.actors.length > 0) {
    out.actors = { actor: c.actors.map(buildActor) };
  }
  if (c.stakeholders && c.stakeholders.length > 0) {
    out.stakeholders = { stakeholder: c.stakeholders.map(buildStakeholder) };
  }
  if (c.constraints && c.constraints.length > 0) {
    out.constraints = { constraint: c.constraints.map(buildConstraint) };
  }
  if (c.policies && c.policies.length > 0) {
    out.policies = { policy: c.policies.map(buildPolicy) };
  }
  if (c.decisions && c.decisions.length > 0) {
    out.decisions = { decision: c.decisions.map(buildDecision) };
  }
  if (c.risks && c.risks.length > 0) {
    out.risks = { risk: c.risks.map(buildRisk) };
  }
  return out;
}

// ---------------------------------------------------------------------------
// domain
// ---------------------------------------------------------------------------

function buildAttribute(a: Attribute): Obj {
  const out: Obj = { "@_id": a.id, "@_name": a.name, "@_type": a.type };
  // Emit as a string so XMLBuilder does not collapse a `true` boolean into a
  // valueless attribute (suppressBooleanAttributes), which the parser then drops.
  if (a.required !== undefined) out["@_required"] = a.required ? "true" : "false";
  setIfDefined(out, "description", a.description);
  setIfDefined(out, "constraints", a.constraints);
  return out;
}

function buildEntity(e: Entity): Obj {
  const out: Obj = { "@_id": e.id, "@_name": e.name };
  setIfDefined(out, "description", e.description);
  if (e.attrs && e.attrs.length > 0) out.attr = e.attrs.map(buildAttribute);
  return out;
}

function buildBusinessRule(r: BusinessRule): Obj {
  const out: Obj = { "@_id": r.id, statement: r.statement };
  setIfDefined(out, "examples", r.examples);
  return out;
}

function buildDomain(d: Domain): Obj {
  const out: Obj = {};
  setIfDefined(out, "overview", d.overview);
  if (d.entities && d.entities.length > 0) {
    out.entities = { entity: d.entities.map(buildEntity) };
  }
  if (d.businessRules && d.businessRules.length > 0) {
    out.businessRules = { rule: d.businessRules.map(buildBusinessRule) };
  }
  return out;
}

// ---------------------------------------------------------------------------
// goals
// ---------------------------------------------------------------------------

function buildGoal(g: Goal): Obj {
  const out: Obj = { "@_id": g.id, "@_title": g.title };
  setIfDefined(out, "@_priority", g.priority);
  setIfDefined(out, "@_status", g.status);
  setIfDefined(out, "@_ownerRef", g.ownerRef);
  out.statement = g.statement;
  setIfDefined(out, "rationale", g.rationale);
  return out;
}

function buildQualityGoal(q: QualityGoal): Obj {
  const out: Obj = { "@_id": q.id, "@_title": q.title };
  setIfDefined(out, "@_priority", q.priority);
  setIfDefined(out, "@_status", q.status);
  out.statement = q.statement;
  setIfDefined(out, "metric", q.metric);
  return out;
}

function buildObstacle(o: Obstacle): Obj {
  const out: Obj = { "@_id": o.id, "@_title": o.title };
  setIfDefined(out, "@_likelihood", o.likelihood);
  setIfDefined(out, "@_severity", o.severity);
  out.statement = o.statement;
  setIfDefined(out, "mitigation", o.mitigation);
  return out;
}

function buildGoalLink(gl: GoalLink): Obj {
  const out: Obj = {
    "@_id": gl.id,
    "@_from": gl.from,
    "@_to": gl.to,
    "@_type": gl.type,
  };
  setIfDefined(out, "@_confidence", gl.confidence);
  return out;
}

function buildGoals(g: Goals): Obj {
  const out: Obj = {};
  if (g.goals && g.goals.length > 0) out.goal = g.goals.map(buildGoal);
  if (g.qualityGoals && g.qualityGoals.length > 0) {
    out.qgoal = g.qualityGoals.map(buildQualityGoal);
  }
  if (g.obstacles && g.obstacles.length > 0) {
    out.obstacle = g.obstacles.map(buildObstacle);
  }
  if (g.goalLinks && g.goalLinks.length > 0) {
    out.goalLink = g.goalLinks.map(buildGoalLink);
  }
  return out;
}

// ---------------------------------------------------------------------------
// scenarios
// ---------------------------------------------------------------------------

function buildScenario(s: Scenario): Obj {
  const out: Obj = { "@_id": s.id, "@_title": s.title };
  setIfDefined(out, "@_actorRef", s.actorRef);
  out.narrative = s.narrative;
  return out;
}

function buildScenarios(s: Scenarios): Obj {
  const out: Obj = {};
  if (s.scenarios && s.scenarios.length > 0) {
    out.scenario = s.scenarios.map(buildScenario);
  }
  if (s.misuseCases && s.misuseCases.length > 0) {
    out.misuseCase = s.misuseCases.map(buildScenario);
  }
  if (s.edgeCases && s.edgeCases.length > 0) {
    out.edgeCase = s.edgeCases.map(buildScenario);
  }
  return out;
}

// ---------------------------------------------------------------------------
// requirements
// ---------------------------------------------------------------------------

function buildCriterion(c: Criterion): Obj {
  const out: Obj = {};
  setIfDefined(out, "@_id", c.id);
  setIfDefined(out, "given", c.given);
  setIfDefined(out, "when", c.when);
  out.then = c.then;
  return out;
}

function buildRequirement(req: Requirement): Obj {
  const out: Obj = {
    "@_id": req.id,
    "@_type": req.type,
    "@_title": req.title,
  };
  setIfDefined(out, "@_status", req.status);
  setIfDefined(out, "@_priority", req.priority);
  setIfDefined(out, "@_ownerRef", req.ownerRef);
  setIfDefined(out, "@_appliesTo", req.appliesTo);
  out.statement = req.statement;
  setIfDefined(out, "rationale", req.rationale);
  setIfDefined(out, "notes", req.notes);
  if (req.acceptance.length > 0) {
    out.acceptance = { criterion: req.acceptance.map(buildCriterion) };
  }
  return out;
}

function buildPackage(pkg: RequirementPackage): Obj {
  const out: Obj = { "@_id": pkg.id, "@_title": pkg.title };
  setIfDefined(out, "@_ownerRef", pkg.ownerRef);
  setIfDefined(out, "description", pkg.description);
  if (pkg.requirements.length > 0) {
    out.req = pkg.requirements.map(buildRequirement);
  }
  return out;
}

// ---------------------------------------------------------------------------
// behavior
// ---------------------------------------------------------------------------

function buildState(st: State): Obj {
  const out: Obj = { "@_id": st.id, "@_name": st.name };
  setIfDefined(out, "@_type", st.type);
  setIfDefined(out, "description", st.description);
  setIfDefined(out, "onEntry", st.onEntry);
  setIfDefined(out, "onExit", st.onExit);
  setIfDefined(out, "invariant", st.invariant);
  return out;
}

function buildTransition(tr: Transition): Obj {
  const out: Obj = { "@_id": tr.id, "@_from": tr.from, "@_to": tr.to };
  setIfDefined(out, "@_event", tr.event);
  setIfDefined(out, "description", tr.description);
  setIfDefined(out, "trigger", tr.trigger);
  setIfDefined(out, "guard", tr.guard);
  setIfDefined(out, "action", tr.action);
  return out;
}

function buildStateMachine(sm: StateMachine): Obj {
  const out: Obj = { "@_id": sm.id, "@_name": sm.name };
  setIfDefined(out, "@_entityRef", sm.entityRef);
  out["@_initial"] = sm.initial;
  setIfDefined(out, "description", sm.description);
  if (sm.states.length > 0) out.state = sm.states.map(buildState);
  if (sm.transitions && sm.transitions.length > 0) {
    out.transition = sm.transitions.map(buildTransition);
  }
  return out;
}

function buildBehavior(b: Behavior): Obj {
  const out: Obj = {};
  if (b.stateMachines && b.stateMachines.length > 0) {
    out.stateMachine = b.stateMachines.map(buildStateMachine);
  }
  return out;
}

// ---------------------------------------------------------------------------
// interfaces
// ---------------------------------------------------------------------------

function buildEndpoint(ep: Endpoint): Obj {
  const out: Obj = { "@_id": ep.id, "@_method": ep.method, "@_path": ep.path };
  setIfDefined(out, "summary", ep.summary);
  setIfDefined(out, "request", ep.request);
  setIfDefined(out, "response", ep.response);
  setIfDefined(out, "errors", ep.errors);
  return out;
}

function buildApi(api: Api): Obj {
  const out: Obj = { "@_id": api.id, "@_name": api.name };
  setIfDefined(out, "@_protocol", api.protocol);
  setIfDefined(out, "@_auth", api.auth);
  setIfDefined(out, "description", api.description);
  if (api.endpoints && api.endpoints.length > 0) {
    out.endpoint = api.endpoints.map(buildEndpoint);
  }
  return out;
}

function buildEvent(ev: ApiEvent): Obj {
  const out: Obj = { "@_id": ev.id, "@_name": ev.name };
  setIfDefined(out, "description", ev.description);
  setIfDefined(out, "payload", ev.payload);
  return out;
}

function buildInterfaces(i: Interfaces): Obj {
  const out: Obj = {};
  if (i.apis && i.apis.length > 0) out.api = i.apis.map(buildApi);
  if (i.events && i.events.length > 0) out.event = i.events.map(buildEvent);
  return out;
}

// ---------------------------------------------------------------------------
// verification
// ---------------------------------------------------------------------------

function buildTestSuite(ts: TestSuite): Obj {
  const out: Obj = { "@_id": ts.id, "@_title": ts.title };
  setIfDefined(out, "description", ts.description);
  return out;
}

function buildTestCase(tc: TestCase): Obj {
  const out: Obj = { "@_id": tc.id, "@_type": tc.type, "@_title": tc.title };
  setIfDefined(out, "purpose", tc.purpose);
  setIfDefined(out, "steps", tc.steps);
  setIfDefined(out, "expected", tc.expected);
  return out;
}

function buildVerification(v: Verification): Obj {
  const out: Obj = {};
  if (v.testSuites && v.testSuites.length > 0) {
    out.testSuite = v.testSuites.map(buildTestSuite);
  }
  if (v.testCases && v.testCases.length > 0) {
    out.testCase = v.testCases.map(buildTestCase);
  }
  return out;
}

// ---------------------------------------------------------------------------
// trace
// ---------------------------------------------------------------------------

function buildLocator(loc: Locator): Obj {
  switch (loc.kind) {
    case "local": {
      const local: Obj = { "@_id": loc.id };
      setIfDefined(local, "@_kind", loc.hintKind);
      setIfDefined(local, "@_title", loc.title);
      return { local };
    }
    case "doc": {
      const doc: Obj = { "@_uri": loc.uri };
      setIfDefined(doc, "@_docId", loc.docId);
      setIfDefined(doc, "@_version", loc.version);
      setIfDefined(doc, "@_git", loc.git);
      doc["@_id"] = loc.id;
      setIfDefined(doc, "@_kind", loc.hintKind);
      setIfDefined(doc, "@_title", loc.title);
      return { doc };
    }
    case "external": {
      const ext: Obj = { "@_uri": loc.uri };
      setIfDefined(ext, "@_kind", loc.hintKind);
      setIfDefined(ext, "@_title", loc.title);
      return { external: ext };
    }
  }
}

function applyEdgeMetaAttrs(out: Obj, edge: TraceEdge): void {
  setIfDefined(out, "@_confidence", edge.confidence);
  setIfDefined(out, "@_status", edge.status);
  setIfDefined(out, "@_createdBy", edge.createdBy);
  setIfDefined(out, "@_createdAt", edge.createdAt);
  if (edge.tags && edge.tags.length > 0) out["@_tags"] = edge.tags.join(" ");
}

/** Nested 2.1.0 `<edge>` form. */
function buildEdge(edge: TraceEdge): Obj {
  const out: Obj = { "@_id": edge.id, "@_type": edge.type };
  applyEdgeMetaAttrs(out, edge);
  out.from = { locator: buildLocator(edge.from) };
  out.to = { locator: buildLocator(edge.to) };
  setIfDefined(out, "notes", edge.notes);
  return out;
}

/**
 * Flat 2.0.1 `<traceEdge>` form. Local/doc endpoints collapse to an id
 * attribute; a doc locator's docId/version/git cannot be expressed in the flat
 * form and is dropped (documented lossy degradation within 2.0.1).
 */
function buildFlatEdge(edge: TraceEdge): Obj {
  const out: Obj = { "@_id": edge.id, "@_type": edge.type };
  if (edge.from.kind === "external") out["@_fromUri"] = edge.from.uri;
  else out["@_from"] = edge.from.id;
  if (edge.to.kind === "external") out["@_toUri"] = edge.to.uri;
  else out["@_to"] = edge.to.id;
  applyEdgeMetaAttrs(out, edge);
  setIfDefined(out, "notes", edge.notes);
  return out;
}

// ---------------------------------------------------------------------------
// governance
// ---------------------------------------------------------------------------

function buildIssue(iss: Issue): Obj {
  const out: Obj = { "@_id": iss.id };
  setIfDefined(out, "@_status", iss.status);
  setIfDefined(out, "@_owner", iss.owner);
  out.statement = iss.statement;
  setIfDefined(out, "notes", iss.notes);
  return out;
}

function buildApproval(ap: Approval): Obj {
  const out: Obj = { "@_id": ap.id, "@_role": ap.role };
  setIfDefined(out, "@_status", ap.status);
  setIfDefined(out, "description", ap.description);
  return out;
}

function buildGovernance(g: Governance): Obj {
  const out: Obj = {};
  if (g.issues && g.issues.length > 0) out.issue = g.issues.map(buildIssue);
  if (g.approvals && g.approvals.length > 0) {
    out.approval = g.approvals.map(buildApproval);
  }
  return out;
}

// ---------------------------------------------------------------------------
// document
// ---------------------------------------------------------------------------

/**
 * Serialize a model back to a well-formed `.rqml` XML string.
 *
 * The output namespace, schema location, and trace serialization are chosen
 * from `doc.version` (2.0.1 emits flat `<traceEdge>`; 2.1.0 emits nested
 * `<edge>`). Sections are written in canonical order and omitted when absent;
 * unknown root attributes and top-level elements retained by {@link parse} are
 * re-emitted, so an unmodified `parse` → `serialize` round-trip preserves the
 * document.
 */
export function serialize(doc: RqmlDocument): string {
  const raw = getRawSections(doc) ?? {};
  const ns = namespaceFor(doc.version);
  const root: Obj = {};

  // Root attributes: namespaces from the version-keyed table, then the
  // model-authoritative identity, then any unknown attrs (forward-compat).
  root["@_xmlns"] = ns.xmlns;
  root["@_xmlns:xsi"] = XSI;
  root["@_xsi:schemaLocation"] = ns.schemaLocation;
  root["@_version"] = doc.version;
  root["@_docId"] = doc.docId;
  root["@_status"] = doc.status;
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith(ATTR_PREFIX) && !(k in root)) root[k] = v;
  }

  // Sections in canonical order.
  root.meta = buildMeta(doc.meta);
  if (doc.catalogs) root.catalogs = buildCatalogs(doc.catalogs);
  if (doc.domain) root.domain = buildDomain(doc.domain);
  if (doc.goals) root.goals = buildGoals(doc.goals);
  if (doc.scenarios) root.scenarios = buildScenarios(doc.scenarios);

  const requirements: Obj = {};
  if (doc.packages.length > 0) {
    requirements.reqPackage = doc.packages.map(buildPackage);
  }
  if (doc.looseRequirements.length > 0) {
    requirements.req = doc.looseRequirements.map(buildRequirement);
  }
  root.requirements = requirements;

  if (doc.behavior) root.behavior = buildBehavior(doc.behavior);
  if (doc.interfaces) root.interfaces = buildInterfaces(doc.interfaces);
  if (doc.verification) root.verification = buildVerification(doc.verification);

  if (doc.trace.length > 0) {
    root.trace =
      doc.version === "2.0.1"
        ? { traceEdge: doc.trace.map(buildFlatEdge) }
        : { edge: doc.trace.map(buildEdge) };
  }

  if (doc.governance) root.governance = buildGovernance(doc.governance);

  // Unknown top-level elements (forward-compat) trail the known sections.
  for (const [k, v] of Object.entries(raw)) {
    if (!k.startsWith(ATTR_PREFIX) && !(k in root)) root[k] = v;
  }

  const body = builder.build({ rqml: root }) as string;
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
}
