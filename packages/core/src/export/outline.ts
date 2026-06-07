/**
 * Document outline: a normalized, fully-typed, stable-ordered projection of an
 * RqmlDocument across every present section. It is the reusable intermediate
 * the export pipeline (and the markdown serializer) consume instead of the raw
 * XML or the WASM-backed validator. Pure and deterministic: no XML, no WASM.
 *
 * Trace edges are resolved via `resolveTrace`, so each element node carries its
 * outgoing references with target titles and a resolved/dangling flag.
 */

import {
  type Criterion,
  type Locator,
  type Requirement,
  type RqmlDocument,
} from "../model/types.js";
import { resolveTrace, type ResolvedEndpoint } from "../trace/index.js";

export interface OutlineField {
  label: string;
  value: string;
}

export interface OutlineRef {
  /** The trace edge type, e.g. "satisfies", "refines". */
  relation: string;
  /** Local id, or the URI for doc/external targets. */
  targetId: string;
  /** Whether a local target id resolved to a declared element. */
  resolved: boolean;
  targetTitle?: string;
}

export interface OutlineNode {
  /** Element kind ("req", "goal", …) or "section" for section wrappers. */
  kind: string;
  id?: string;
  title: string;
  fields: OutlineField[];
  refs?: OutlineRef[];
  children?: OutlineNode[];
}

export interface DocumentOutline {
  docId: string;
  version: string;
  status: string;
  title: string;
  system: string;
  summary?: string;
  sections: OutlineNode[];
}

function fields(...pairs: Array<[string, string | undefined]>): OutlineField[] {
  const out: OutlineField[] = [];
  for (const [label, value] of pairs) {
    if (value !== undefined && value !== "") out.push({ label, value });
  }
  return out;
}

function locatorLabel(loc: Locator): string {
  if (loc.kind === "local") return loc.id;
  if (loc.kind === "doc") return `${loc.uri}#${loc.id}`;
  return loc.uri;
}

/**
 * Human title for every id-bearing element, so trace tables and refs to
 * non-requirement targets (goals, risks, states, …) read meaningfully. First
 * declaration wins, mirroring `declaredElements`/`declaredIdIndex`.
 */
function collectTitles(doc: RqmlDocument): Map<string, string> {
  const m = new Map<string, string>();
  const set = (id: string | undefined, title: string | undefined): void => {
    if (id !== undefined && title !== undefined && title !== "" && !m.has(id)) {
      m.set(id, title);
    }
  };
  for (const p of doc.meta.profiles ?? []) set(p.id, p.type);
  const c = doc.catalogs;
  if (c) {
    for (const t of c.glossary ?? []) set(t.id, t.name);
    for (const a of c.actors ?? []) set(a.id, a.name);
    for (const s of c.stakeholders ?? []) set(s.id, s.name);
    for (const x of c.constraints ?? []) set(x.id, x.statement);
    for (const x of c.policies ?? []) set(x.id, x.obligation);
    for (const x of c.decisions ?? []) set(x.id, x.decision);
    for (const x of c.risks ?? []) set(x.id, x.statement);
  }
  const d = doc.domain;
  if (d) {
    for (const e of d.entities ?? []) {
      set(e.id, e.name);
      for (const a of e.attrs ?? []) set(a.id, a.name);
    }
    for (const r of d.businessRules ?? []) set(r.id, r.statement);
  }
  const g = doc.goals;
  if (g) {
    for (const x of g.goals ?? []) set(x.id, x.title);
    for (const x of g.qualityGoals ?? []) set(x.id, x.title);
    for (const x of g.obstacles ?? []) set(x.id, x.title);
    for (const x of g.goalLinks ?? []) set(x.id, x.id);
  }
  const sc = doc.scenarios;
  if (sc) {
    for (const x of sc.scenarios ?? []) set(x.id, x.title);
    for (const x of sc.misuseCases ?? []) set(x.id, x.title);
    for (const x of sc.edgeCases ?? []) set(x.id, x.title);
  }
  for (const p of doc.packages) {
    set(p.id, p.title);
    for (const r of p.requirements) set(r.id, r.title);
  }
  for (const r of doc.looseRequirements) set(r.id, r.title);
  const b = doc.behavior;
  if (b) {
    for (const sm of b.stateMachines ?? []) {
      set(sm.id, sm.name);
      for (const st of sm.states) set(st.id, st.name);
    }
  }
  const it = doc.interfaces;
  if (it) {
    for (const api of it.apis ?? []) {
      set(api.id, api.name);
      for (const ep of api.endpoints ?? []) set(ep.id, `${ep.method} ${ep.path}`);
    }
    for (const ev of it.events ?? []) set(ev.id, ev.name);
  }
  const v = doc.verification;
  if (v) {
    for (const ts of v.testSuites ?? []) set(ts.id, ts.title);
    for (const tc of v.testCases ?? []) set(tc.id, tc.title);
  }
  const gv = doc.governance;
  if (gv) {
    for (const x of gv.issues ?? []) set(x.id, x.statement);
    for (const x of gv.approvals ?? []) set(x.id, x.role);
  }
  return m;
}

function endpointTitle(
  ep: ResolvedEndpoint,
  titleById: Map<string, string>,
): string | undefined {
  if (ep.requirement !== undefined) return ep.requirement.title;
  if (ep.locator.title !== undefined) return ep.locator.title;
  if (ep.locator.kind === "local") return titleById.get(ep.locator.id);
  return undefined;
}

function endpointLabel(
  ep: ResolvedEndpoint,
  titleById: Map<string, string>,
): string {
  let s = locatorLabel(ep.locator);
  const hint = endpointTitle(ep, titleById);
  if (hint !== undefined) s += ` (${hint})`;
  if (ep.locator.kind === "local" && ep.target === undefined) s += " [unresolved]";
  return s;
}

export function buildOutline(doc: RqmlDocument): DocumentOutline {
  const res = resolveTrace(doc);
  const titleById = collectTitles(doc);

  const refsBySource = new Map<string, OutlineRef[]>();
  for (const re of res.edges) {
    if (re.from.locator.kind !== "local") continue;
    const toLoc = re.to.locator;
    const targetId = toLoc.kind === "local" ? toLoc.id : toLoc.uri;
    const resolved = toLoc.kind === "local" ? re.to.target !== undefined : true;
    const ref: OutlineRef = { relation: re.edge.type, targetId, resolved };
    const tt = endpointTitle(re.to, titleById);
    if (tt !== undefined) ref.targetTitle = tt;
    const arr = refsBySource.get(re.from.locator.id);
    if (arr) arr.push(ref);
    else refsBySource.set(re.from.locator.id, [ref]);
  }

  const node = (
    kind: string,
    id: string | undefined,
    title: string,
    flds: OutlineField[],
    children?: OutlineNode[],
  ): OutlineNode => {
    const n: OutlineNode = { kind, title, fields: flds };
    if (id !== undefined) n.id = id;
    const refs = id !== undefined ? refsBySource.get(id) : undefined;
    if (refs && refs.length > 0) n.refs = refs;
    if (children && children.length > 0) n.children = children;
    return n;
  };

  const sections: OutlineNode[] = [];
  const pushSection = (
    title: string,
    flds: OutlineField[],
    nodes: OutlineNode[],
  ): void => {
    if (flds.length === 0 && nodes.length === 0) return;
    const s: OutlineNode = { kind: "section", title, fields: flds };
    if (nodes.length > 0) s.children = nodes;
    sections.push(s);
  };

  const meta = doc.meta;

  // --- Meta extras (dates, conventions, profiles) ---
  pushSection(
    "Meta",
    fields(
      ["Created", meta.dates?.created],
      ["Updated", meta.dates?.updated],
      ["Target release", meta.dates?.targetRelease],
      ["Normative keywords", meta.conventions?.normativeKeywords],
      ["ID conventions", meta.conventions?.idConventions],
    ),
    (meta.profiles ?? []).map((p) =>
      node("profile", p.id, p.type, fields(["Description", p.description])),
    ),
  );

  // --- Catalogs ---
  const cat = doc.catalogs;
  if (cat) {
    pushSection(
      "Glossary",
      [],
      (cat.glossary ?? []).map((t) =>
        node(
          "term",
          t.id,
          t.name,
          fields(
            ["Definition", t.definition],
            ["Synonyms", t.synonyms?.join(", ")],
          ),
        ),
      ),
    );
    pushSection(
      "Actors",
      [],
      (cat.actors ?? []).map((a) =>
        node(
          "actor",
          a.id,
          a.name,
          fields(
            ["Type", a.type],
            ["Description", a.description],
            ["Goal refs", a.goalRefs?.join(", ")],
          ),
        ),
      ),
    );
    pushSection(
      "Stakeholders",
      [],
      (cat.stakeholders ?? []).map((s) =>
        node(
          "stakeholder",
          s.id,
          s.name,
          fields(["Org", s.org], ["Concerns", s.concerns]),
        ),
      ),
    );
    pushSection(
      "Constraints",
      [],
      (cat.constraints ?? []).map((c) =>
        node(
          "constraint",
          c.id,
          c.statement,
          fields(["Severity", c.severity], ["Source", c.source]),
        ),
      ),
    );
    pushSection(
      "Policies",
      [],
      (cat.policies ?? []).map((p) =>
        node(
          "policy",
          p.id,
          p.obligation,
          fields(["Source", p.source], ["Evidence", p.evidence]),
        ),
      ),
    );
    pushSection(
      "Decisions",
      [],
      (cat.decisions ?? []).map((d) =>
        node(
          "decision",
          d.id,
          d.decision,
          fields(
            ["Status", d.status],
            ["Context", d.context],
            ["Alternatives", d.alternatives],
            ["Consequences", d.consequences],
          ),
        ),
      ),
    );
    pushSection(
      "Risks",
      [],
      (cat.risks ?? []).map((r) =>
        node(
          "risk",
          r.id,
          r.statement,
          fields(["Severity", r.severity], ["Mitigation", r.mitigation]),
        ),
      ),
    );
  }

  // --- Domain ---
  const dom = doc.domain;
  if (dom) {
    const entityNodes = (dom.entities ?? []).map((e) =>
      node(
        "entity",
        e.id,
        e.name,
        fields(["Description", e.description]),
        (e.attrs ?? []).map((a) =>
          node(
            "attr",
            a.id,
            a.name,
            fields(
              ["Type", a.type],
              ["Required", a.required === undefined ? undefined : String(a.required)],
              ["Description", a.description],
              ["Constraints", a.constraints],
            ),
          ),
        ),
      ),
    );
    const ruleNodes = (dom.businessRules ?? []).map((r) =>
      node("rule", r.id, r.statement, fields(["Examples", r.examples])),
    );
    pushSection(
      "Domain",
      fields(["Overview", dom.overview]),
      [...entityNodes, ...ruleNodes],
    );
  }

  // --- Goals ---
  const goals = doc.goals;
  if (goals) {
    pushSection(
      "Goals",
      [],
      (goals.goals ?? []).map((g) =>
        node(
          "goal",
          g.id,
          g.title,
          fields(
            ["Priority", g.priority],
            ["Status", g.status],
            ["Owner", g.ownerRef],
            ["Statement", g.statement],
            ["Rationale", g.rationale],
          ),
        ),
      ),
    );
    pushSection(
      "Quality goals",
      [],
      (goals.qualityGoals ?? []).map((g) =>
        node(
          "qgoal",
          g.id,
          g.title,
          fields(
            ["Priority", g.priority],
            ["Status", g.status],
            ["Statement", g.statement],
            ["Metric", g.metric],
          ),
        ),
      ),
    );
    pushSection(
      "Obstacles",
      [],
      (goals.obstacles ?? []).map((o) =>
        node(
          "obstacle",
          o.id,
          o.title,
          fields(
            ["Likelihood", o.likelihood],
            ["Severity", o.severity],
            ["Statement", o.statement],
            ["Mitigation", o.mitigation],
          ),
        ),
      ),
    );
    pushSection(
      "Goal links",
      [],
      (goals.goalLinks ?? []).map((l) =>
        node(
          "goalLink",
          l.id,
          l.id,
          fields(
            ["From", l.from],
            ["To", l.to],
            ["Type", l.type],
            ["Confidence", l.confidence?.toString()],
          ),
        ),
      ),
    );
  }

  // --- Scenarios ---
  const sc = doc.scenarios;
  if (sc) {
    const scNode = (kind: string) => (s: { id: string; title: string; actorRef?: string; narrative: string }) =>
      node(
        kind,
        s.id,
        s.title,
        fields(["Actor", s.actorRef], ["Narrative", s.narrative]),
      );
    pushSection("Scenarios", [], (sc.scenarios ?? []).map(scNode("scenario")));
    pushSection("Misuse cases", [], (sc.misuseCases ?? []).map(scNode("misuseCase")));
    pushSection("Edge cases", [], (sc.edgeCases ?? []).map(scNode("edgeCase")));
  }

  // --- Requirements ---
  const criterionNode = (c: Criterion): OutlineNode =>
    node(
      "criterion",
      c.id,
      c.id ?? "Acceptance criterion",
      fields(["Given", c.given], ["When", c.when], ["Then", c.then]),
    );
  const reqNode = (r: Requirement): OutlineNode =>
    node(
      "req",
      r.id,
      r.title,
      fields(
        ["Type", r.type],
        ["Status", r.status],
        ["Priority", r.priority],
        ["Owner", r.ownerRef],
        ["Applies to", r.appliesTo],
        ["Statement", r.statement],
        ["Rationale", r.rationale],
        ["Notes", r.notes],
      ),
      r.acceptance.map(criterionNode),
    );
  const reqNodes: OutlineNode[] = [
    ...doc.packages.map((p) =>
      node(
        "reqPackage",
        p.id,
        p.title,
        fields(["Owner", p.ownerRef], ["Description", p.description]),
        p.requirements.map(reqNode),
      ),
    ),
    ...doc.looseRequirements.map(reqNode),
  ];
  pushSection("Requirements", [], reqNodes);

  // --- Behavior ---
  const beh = doc.behavior;
  if (beh) {
    pushSection(
      "Behavior",
      [],
      (beh.stateMachines ?? []).map((sm) =>
        node(
          "stateMachine",
          sm.id,
          sm.name,
          fields(
            ["Initial", sm.initial],
            ["Entity", sm.entityRef],
            ["Description", sm.description],
          ),
          [
            ...sm.states.map((st) =>
              node(
                "state",
                st.id,
                st.name,
                fields(
                  ["Type", st.type],
                  ["Description", st.description],
                  ["On entry", st.onEntry],
                  ["On exit", st.onExit],
                  ["Invariant", st.invariant],
                ),
              ),
            ),
            ...(sm.transitions ?? []).map((tr) =>
              node(
                "transition",
                tr.id,
                `${tr.from} → ${tr.to}`,
                fields(
                  ["From", tr.from],
                  ["To", tr.to],
                  ["Event", tr.event],
                  ["Trigger", tr.trigger],
                  ["Guard", tr.guard],
                  ["Action", tr.action],
                  ["Description", tr.description],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --- Interfaces ---
  const ifaces = doc.interfaces;
  if (ifaces) {
    const apiNodes = (ifaces.apis ?? []).map((api) =>
      node(
        "api",
        api.id,
        api.name,
        fields(
          ["Protocol", api.protocol],
          ["Auth", api.auth],
          ["Description", api.description],
        ),
        (api.endpoints ?? []).map((ep) =>
          node(
            "endpoint",
            ep.id,
            `${ep.method} ${ep.path}`,
            fields(
              ["Summary", ep.summary],
              ["Request", ep.request],
              ["Response", ep.response],
              ["Errors", ep.errors],
            ),
          ),
        ),
      ),
    );
    const eventNodes = (ifaces.events ?? []).map((ev) =>
      node(
        "event",
        ev.id,
        ev.name,
        fields(["Description", ev.description], ["Payload", ev.payload]),
      ),
    );
    pushSection("Interfaces", [], [...apiNodes, ...eventNodes]);
  }

  // --- Verification ---
  const ver = doc.verification;
  if (ver) {
    const suiteNodes = (ver.testSuites ?? []).map((ts) =>
      node("testSuite", ts.id, ts.title, fields(["Description", ts.description])),
    );
    const caseNodes = (ver.testCases ?? []).map((tc) =>
      node(
        "testCase",
        tc.id,
        tc.title,
        fields(
          ["Type", tc.type],
          ["Purpose", tc.purpose],
          ["Steps", tc.steps],
          ["Expected", tc.expected],
        ),
      ),
    );
    pushSection("Verification", [], [...suiteNodes, ...caseNodes]);
  }

  // --- Trace ---
  const edgeNodes = res.edges.map((re) => {
    const e = re.edge;
    return node(
      "edge",
      e.id,
      e.id,
      fields(
        ["Type", e.type],
        ["From", endpointLabel(re.from, titleById)],
        ["To", endpointLabel(re.to, titleById)],
        ["Confidence", e.confidence?.toString()],
        ["Status", e.status],
        ["Created by", e.createdBy],
        ["Created at", e.createdAt],
        ["Tags", e.tags?.join(" ")],
        ["Notes", e.notes],
      ),
    );
  });
  pushSection("Trace", [], edgeNodes);

  // --- Governance ---
  const gov = doc.governance;
  if (gov) {
    const issueNodes = (gov.issues ?? []).map((i) =>
      node(
        "issue",
        i.id,
        i.statement,
        fields(["Status", i.status], ["Owner", i.owner], ["Notes", i.notes]),
      ),
    );
    const approvalNodes = (gov.approvals ?? []).map((a) =>
      node(
        "approval",
        a.id,
        a.role,
        fields(["Status", a.status], ["Description", a.description]),
      ),
    );
    pushSection("Governance", [], [...issueNodes, ...approvalNodes]);
  }

  const outline: DocumentOutline = {
    docId: doc.docId,
    version: doc.version,
    status: doc.status,
    title: meta.title,
    system: meta.system,
    sections,
  };
  if (meta.summary !== undefined) outline.summary = meta.summary;
  return outline;
}
