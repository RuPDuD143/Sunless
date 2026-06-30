// js/world.js
// Builds the ground plane and decides where trees go. Tree *meshes* live
// in Tree.js — this file only decides the layout so every client (and the
// server-less Firebase sync) agrees on tree IDs/positions without us
// having to transmit every tree.

import * as THREE from "three";
import { mulberry32 } from "./utils.js";

export const WORLD_SIZE = 160; // ground is WORLD_SIZE x WORLD_SIZE
export const FOREST_SEED = 1337; // change to regenerate a different forest

export function buildGround(scene) {
  const groundGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 1, 1);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x2a3a22,
    roughness: 1,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Sparse undergrowth speckle so the ground doesn't look like a flat
  // pool table — cheap instanced quads.
  return ground;
}

// Deterministically generate tree placements, keeping a clearing around
// the world origin (where the main campfire sits).
export function generateTreeLayout() {
  const rand = mulberry32(FOREST_SEED);
  const trees = [];
  const clearingRadius = 9;
  const count = 220;

  let i = 0;
  let guard = 0;
  while (i < count && guard < count * 20) {
    guard++;
    const x = (rand() - 0.5) * WORLD_SIZE * 0.95;
    const z = (rand() - 0.5) * WORLD_SIZE * 0.95;
    if (Math.sqrt(x * x + z * z) < clearingRadius) continue;

    // Keep trees from overlapping each other too tightly.
    let tooClose = false;
    for (const t of trees) {
      const dx = t.x - x;
      const dz = t.z - z;
      if (dx * dx + dz * dz < 4.5 * 4.5) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const scale = 0.8 + rand() * 0.6;
    trees.push({
      id: "t" + i,
      x,
      z,
      scale,
      hue: 0.28 + rand() * 0.08,
    });
    i++;
  }

  return trees;
}
