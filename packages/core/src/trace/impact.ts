import type { Locator, RqmlDocument, TraceType } from "../model/types.js";
import { declaredIdIndex } from "./index.js";

/** One edge traversal in an impact path. */
export interface ImpactStep {
  edgeId: string;
  type: TraceType;
  /** "outgoing" follows from→to; "incoming" follows to→from. */
  direction: "outgoing" | "incoming";
  /** Local id or doc/external URI at the far end of the edge. */
  target: string;
}

/** An artifact reachable from the queried id over the trace graph. */
export interface ImpactedArtifact {
  /** Local id, or the URI of a doc/external endpoint. */
  id: string;
  /** Element kind for local artifacts ("req", "goal", …), else the locator kind. */
  kind: string;
  /** Edge distance from the queried artifact. */
  distance: number;
  /** Edge chain from the queried artifact to this one. */
  path: ImpactStep[];
}

/** Affected ids grouped by the type/direction of the edge that reached them. */
export interface ImpactGroup {
  direction: "outgoing" | "incoming";
  type: TraceType;
  ids: string[];
}

export interface ImpactReport {
  id: string;
  /** Every reachable artifact, sorted by distance then id. */
  affected: ImpactedArtifact[];
  groups: ImpactGroup[];
}

function endpointKey(locator: Locator): string {
  return locator.kind === "local" ? locator.id : locator.uri;
}

/**
 * Answer "what is affected if this artifact changes?" by traversing the trace
 * graph transitively in both directions from `id` (REQ-LOOP-IMPACT, SCN-IMPACT).
 * Breadth-first, cycle-safe, and deterministic: edges are visited in document
 * order and every output list is sorted. Doc and external endpoints are
 * reported but not traversed through; goalLinks are out of scope.
 */
export function impactOf(doc: RqmlDocument, id: string): ImpactReport {
  const idIndex = declaredIdIndex(doc);
  const visited = new Set<string>([id]);
  const affected: ImpactedArtifact[] = [];

  let frontier: { key: string; path: ImpactStep[] }[] = [{ key: id, path: [] }];
  let distance = 0;
  while (frontier.length > 0) {
    distance += 1;
    const next: typeof frontier = [];
    for (const node of frontier) {
      for (const edge of doc.trace) {
        const fromKey = endpointKey(edge.from);
        const toKey = endpointKey(edge.to);
        const hops: { direction: "outgoing" | "incoming"; here: string; far: Locator }[] =
          [
            { direction: "outgoing", here: fromKey, far: edge.to },
            { direction: "incoming", here: toKey, far: edge.from },
          ];
        for (const hop of hops) {
          const farKey = endpointKey(hop.far);
          if (hop.here !== node.key || visited.has(farKey)) continue;
          visited.add(farKey);
          const local = hop.far.kind === "local";
          const kind = local ? (idIndex.get(farKey)?.kind ?? "unknown") : hop.far.kind;
          const step: ImpactStep = {
            edgeId: edge.id,
            type: edge.type,
            direction: hop.direction,
            target: farKey,
          };
          const path = [...node.path, step];
          affected.push({ id: farKey, kind, distance, path });
          if (local) next.push({ key: farKey, path });
        }
      }
    }
    frontier = next;
  }

  affected.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));

  const groupIndex = new Map<string, ImpactGroup>();
  for (const artifact of affected) {
    const last = artifact.path[artifact.path.length - 1];
    if (last === undefined) continue;
    const key = `${last.direction}:${last.type}`;
    let group = groupIndex.get(key);
    if (group === undefined) {
      group = { direction: last.direction, type: last.type, ids: [] };
      groupIndex.set(key, group);
    }
    group.ids.push(artifact.id);
  }
  const groups = [...groupIndex.values()]
    .map((g) => ({ ...g, ids: [...new Set(g.ids)].sort() }))
    .sort(
      (a, b) => a.direction.localeCompare(b.direction) || a.type.localeCompare(b.type),
    );

  return { id, affected, groups };
}
