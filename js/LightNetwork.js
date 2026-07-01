// js/LightNetwork.js
// The core "shroud" mechanic. Every fire (the eternal main campfire, plus
// any player-built ones) is a circle of light. Two things are computed
// from these circles:
//
// 1. PROTECTION — isPositionLit(): is this position within range of any
//    currently-lit fire, period. Any burning fire protects, regardless of
//    whether it's chained to anything else.
//
// 2. VISIBILITY — getClusterContaining(): which fires (and by extension,
//    which trees/players near them) the PLAYER CAN SEE right now. This is
//    strictly the connected cluster of overlapping, lit fires that the
//    player is currently standing inside. Fires outside that cluster —
//    even the eternal main fire — are not rendered. If the player isn't
//    standing in any fire's radius at all, the cluster is empty and the
//    world goes fully black (see main.js's render loop).

import { dist2D } from "./utils.js";

const MAIN_FIRE_DIAMETER = 12; // meters (doubled again per feedback — was 6m)
export const MAIN_FIRE_RADIUS = MAIN_FIRE_DIAMETER / 2;

export class LightNetwork {
  constructor() {
    /** @type {Map<string, {id:string, x:number, z:number, radius:number, isMain:boolean, lit:boolean}>} */
    this.sources = new Map();

    this.addSource({
      id: "main",
      x: 0,
      z: 0,
      radius: MAIN_FIRE_RADIUS,
      isMain: true,
      lit: true, // eternal
    });
  }

  addSource(src) {
    this.sources.set(src.id, {
      id: src.id,
      x: src.x,
      z: src.z,
      radius: src.radius,
      isMain: !!src.isMain,
      lit: src.lit !== false,
    });
  }

  removeSource(id) {
    if (id === "main") return; // eternal, can't be removed
    this.sources.delete(id);
  }

  setLit(id, lit) {
    const s = this.sources.get(id);
    if (!s) return;
    s.lit = lit;
  }

  updatePosition(id, x, z) {
    const s = this.sources.get(id);
    if (!s) return;
    s.x = x;
    s.z = z;
  }

  // Any burning fire protects a position within its radius — no chain
  // requirement. See header comment.
  isPositionLit(x, z) {
    for (const s of this.sources.values()) {
      if (!s.lit) continue;
      if (dist2D(x, z, s.x, s.z) <= s.radius) return true;
    }
    return false;
  }

  // Returns a Set of source ids forming the connected, lit cluster the
  // given position is currently standing inside (BFS over overlapping
  // circles), or an empty Set if the position isn't within any lit fire
  // at all — i.e. the player is blind.
  getClusterContaining(x, z) {
    let start = null;
    for (const s of this.sources.values()) {
      if (s.lit && dist2D(x, z, s.x, s.z) <= s.radius) {
        start = s;
        break;
      }
    }
    if (!start) return new Set();

    const visited = new Set([start.id]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift();
      for (const other of this.sources.values()) {
        if (visited.has(other.id) || !other.lit) continue;
        if (dist2D(cur.x, cur.z, other.x, other.z) <= cur.radius + other.radius) {
          visited.add(other.id);
          queue.push(other);
        }
      }
    }
    return visited;
  }

  // Is (x, z) within reach of any source that belongs to the given
  // cluster (a Set of ids from getClusterContaining)? Used to decide
  // whether a tree/player near a visible fire should be drawn.
  isVisibleInCluster(x, z, cluster) {
    if (!cluster || cluster.size === 0) return false;
    for (const id of cluster) {
      const s = this.sources.get(id);
      if (s && dist2D(x, z, s.x, s.z) <= s.radius) return true;
    }
    return false;
  }

  getAllSources() {
    return [...this.sources.values()];
  }
}
