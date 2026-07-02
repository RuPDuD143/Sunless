// js/world.js
// Builds the ground plane and decides where trees go. Tree *meshes* live
// in Tree.js — this file only decides the layout so every client (and the
// server-less Firebase sync) agrees on tree IDs/positions without us
// having to transmit every tree.

import * as THREE from "three";
import { mulberry32 } from "./utils.js";
import { MAIN_FIRE_RADIUS } from "./LightNetwork.js";

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
  const clearingRadius = 9; // open camp area around the main fire
  const count = 380; // denser forest
  const minSpacing = 3.2; // tighter packing than before (was 4.5)

  let i = 0;
  let guard = 0;
  while (i < count && guard < count * 30) {
    guard++;
    const x = (rand() - 0.5) * WORLD_SIZE * 0.95;
    const z = (rand() - 0.5) * WORLD_SIZE * 0.95;
    if (Math.sqrt(x * x + z * z) < clearingRadius) continue;

    // Keep trees from overlapping each other too tightly.
    let tooClose = false;
    for (const t of trees) {
      const dx = t.x - x;
      const dz = t.z - z;
      if (dx * dx + dz * dz < minSpacing * minSpacing) {
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

  // Exactly four trees guaranteed inside the main campfire's actual light
  // radius, so they're visible and choppable the moment a fresh player
  // spawns. Every other forest tree is kept out past the clearing, so
  // it exists in the dark but stays unseen until a fire's light reaches it.
  const guaranteedCount = 4;
  const innerMargin = 2.5; // stay clear of the fire's own mesh
  const outerMargin = MAIN_FIRE_RADIUS - 1; // stay safely inside the lit radius
  for (let g = 0; g < guaranteedCount; g++) {
    const angle = ((Math.PI * 2) / guaranteedCount) * g + rand() * 0.6;
    const r = innerMargin + rand() * (outerMargin - innerMargin);
    trees.push({
      id: "t-safezone-" + g,
      x: Math.cos(angle) * r, // (* r)
      z: Math.sin(angle) * r,
      scale: 0.8 + rand() * 0.5,
      hue: 0.3,
    });
  }

  return trees;
}
