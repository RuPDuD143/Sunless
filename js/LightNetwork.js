// js/LightNetwork.js
// The core "shroud" mechanic. Every fire (the eternal main campfire, plus
// any player-built ones) is a circle of light. A fire only counts as part
// of the network — and is only visible/safe — if its circle overlaps
// another connected circle, in an unbroken chain back to the main fire
// (see the reference images: isolated fires go dark and get crossed out).

import { dist2D } from "./utils.js";

const MAIN_FIRE_DIAMETER = 6; // meters (doubled per feedback — was 3m)
export const MAIN_FIRE_RADIUS = MAIN_FIRE_DIAMETER / 2;

export class LightNetwork {
  constructor() {
    /** @type {Map<string, {id:string, x:number, z:number, radius:number, isMain:boolean, lit:boolean, connected:boolean}>} */
    this.sources = new Map();

    this.addSource({
      id: "main",
      x: 0,
      z: 0,
      radius: MAIN_FIRE_RADIUS,
      isMain: true,
      lit: true, // eternal
    });

    this._recompute();
  }

  addSource(src) {
    this.sources.set(src.id, {
      id: src.id,
      x: src.x,
      z: src.z,
      radius: src.radius,
      isMain: !!src.isMain,
      lit: src.lit !== false,
      connected: false,
    });
    this._recompute();
  }

  removeSource(id) {
    if (id === "main") return; // eternal, can't be removed
    this.sources.delete(id);
    this._recompute();
  }

  setLit(id, lit) {
    const s = this.sources.get(id);
    if (!s) return;
    s.lit = lit;
    this._recompute();
  }

  updatePosition(id, x, z) {
    const s = this.sources.get(id);
    if (!s) return;
    s.x = x;
    s.z = z;
    this._recompute();
  }

  // BFS from "main" across overlapping, currently-lit circles.
  _recompute() {
    for (const s of this.sources.values()) s.connected = false;

    const main = this.sources.get("main");
    if (!main) return;

    const queue = [main];
    main.connected = true;

    while (queue.length) {
      const cur = queue.shift();
      for (const other of this.sources.values()) {
        if (other.connected || !other.lit) continue;
        const d = dist2D(cur.x, cur.z, other.x, other.z);
        if (d <= cur.radius + other.radius) {
          other.connected = true;
          queue.push(other);
        }
      }
    }
  }

  // A position is "safe" (lit + connected to the network) if it falls
  // inside the radius of any connected, lit source.
  isPositionLit(x, z) {
    for (const s of this.sources.values()) {
      if (!s.connected || !s.lit) continue;
      if (dist2D(x, z, s.x, s.z) <= s.radius) return true;
    }
    return false;
  }

  getConnectedSources() {
    return [...this.sources.values()].filter((s) => s.connected && s.lit);
  }

  getAllSources() {
    return [...this.sources.values()];
  }
}
