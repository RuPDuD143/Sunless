// js/Tree.js
// A single choppable tree. Visuals are simple low-poly shapes (cone +
// cylinder) so the forest stays cheap to render in bulk.

import * as THREE from "three";

const CHOPS_TO_FELL = 4; // lvl0 axe hits needed
const LOGS_PER_TREE = 3;
const RESPAWN_SECONDS = 90;
const FLASH_DURATION = 0.4; // white "purified from darkness" flash on reveal

export class Tree {
  constructor(scene, data) {
    this.id = data.id;
    this.x = data.x;
    this.z = data.z;
    this.scale = data.scale;

    this.chops = 0;
    this.felled = false;
    this.respawnTimer = 0;
    this.flashT = 0; // counts down from FLASH_DURATION when triggered

    this.group = new THREE.Group();
    this.group.position.set(this.x, 0, this.z);
    this.group.scale.setScalar(this.scale);

    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.24, 2.2, 7);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x4a3322,
      roughness: 1,
      emissive: 0xffffff,
      emissiveIntensity: 0,
    });
    this.trunk = new THREE.Mesh(trunkGeo, trunkMat);
    this.trunk.position.y = 1.1;
    this.trunk.castShadow = true;
    this.trunk.receiveShadow = true;
    this.group.add(this.trunk);

    const leafGeo = new THREE.ConeGeometry(1.3, 2.6, 8);
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x2d6a2d,
      roughness: 1,
      emissive: 0xffffff,
      emissiveIntensity: 0,
    });
    this.leaves = new THREE.Mesh(leafGeo, leafMat);
    this.leaves.position.y = 3.0;
    this.leaves.castShadow = true;
    this.group.add(this.leaves);

    this.stumpGeo = new THREE.CylinderGeometry(0.22, 0.26, 0.35, 7);
    this.stumpMat = new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 1 });
    this.stump = new THREE.Mesh(this.stumpGeo, this.stumpMat);
    this.stump.position.y = 0.18;
    this.stump.visible = false;
    this.group.add(this.stump);

    scene.add(this.group);
  }

  // Called by a player swinging a lvl0 axe (which never breaks/depletes).
  chop() {
    if (this.felled) return { felled: false, logs: 0 };
    this.chops++;
    if (this.chops >= CHOPS_TO_FELL) {
      this.fell();
      return { felled: true, logs: LOGS_PER_TREE };
    }
    return { felled: false, logs: 0 };
  }

  fell() {
    this.felled = true;
    this.trunk.visible = false;
    this.leaves.visible = false;
    this.stump.visible = true;
    this.respawnTimer = RESPAWN_SECONDS;
  }

  // Apply remote state without re-running chop logic locally (used when
  // syncing from Firebase so we don't double-count hits).
  applyRemoteState(chops, felled) {
    this.chops = chops;
    if (felled && !this.felled) {
      this.fell();
    } else if (!felled && this.felled) {
      this.felled = false;
      this.chops = 0;
      this.trunk.visible = true;
      this.leaves.visible = true;
      this.stump.visible = false;
    }
  }

  // Called by main.js when this tree transitions from hidden to visible
  // (i.e. a fire's light just reached it) — briefly tints it white then
  // fades back to normal, like it's being "purified" out of the dark.
  triggerFlash() {
    this.flashT = FLASH_DURATION;
  }

  update(dt) {
    if (this.felled) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.felled = false;
        this.chops = 0;
        this.trunk.visible = true;
        this.leaves.visible = true;
        this.stump.visible = false;
      }
    }

    if (this.flashT > 0) {
      this.flashT = Math.max(0, this.flashT - dt);
      const intensity = this.flashT / FLASH_DURATION;
      this.trunk.material.emissiveIntensity = intensity;
      this.leaves.material.emissiveIntensity = intensity;
    }
  }

  distanceTo(x, z) {
    const dx = this.x - x;
    const dz = this.z - z;
    return Math.sqrt(dx * dx + dz * dz);
  }
}
