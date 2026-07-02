// js/Campfire.js
// Visual + lifespan logic for a single campfire. The MAIN campfire is
// eternal (infinite fuel). Player-built campfires start with a 10-minute
// lifespan (granted by the 10-log build cost) and gain +45s per extra log.

import * as THREE from "three";
import { MAIN_FIRE_RADIUS } from "./LightNetwork.js";

const PLAYER_FIRE_BASE_SECONDS = 10 * 60;
const SECONDS_PER_LOG = 45;
const PLAYER_FIRE_RADIUS = MAIN_FIRE_RADIUS; // "same power as main campfire"
const IGNITE_RAMP_SECONDS = 0.5; // newly-placed fires brighten in over this long

export class Campfire {
  constructor(scene, { id, x, z, isMain = false }) {
    this.id = id;
    this.x = x;
    this.z = z;
    this.isMain = isMain;
    this.radius = isMain ? MAIN_FIRE_RADIUS : PLAYER_FIRE_RADIUS;
    this.fuelSeconds = isMain ? Infinity : PLAYER_FIRE_BASE_SECONDS;
    this.out = false;

    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);

    const ringMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1 });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.12, 10), ringMat);
    ring.position.y = 0.06;
    this.group.add(ring);

    const logMat = new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 1 });
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 6), logMat);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = (Math.PI / 2) * i + 0.4;
      log.position.y = 0.15;
      this.group.add(log);
    }

    this.flameMat = new THREE.MeshStandardMaterial({
      color: 0xffa030,
      emissive: 0xff7a1a,
      emissiveIntensity: 1.6,
    });
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.65, 8), this.flameMat);
    this.flame.position.y = 0.45;
    this.group.add(this.flame);

    this.light = new THREE.PointLight(0xff9a45, isMain ? 3.2 : 2.6, this.radius * 2.6, 1.8);
    this.light.position.y = 0.6;
    // Shadow-casting is expensive for point lights (6-face cubemap render
    // per light, per frame) so it's OFF by default here and only turned on
    // for a small, distance-based subset of fires — see the
    // MAX_SHADOW_CASTERS logic in main.js's animate loop, which calls
    // setShadowCaster() each frame.
    this.light.castShadow = false;
    this.light.shadow.mapSize.set(256, 256);
    this.light.shadow.camera.near = 0.2;
    this.light.shadow.camera.far = this.radius * 2.6;
    this.light.shadow.bias = -0.002;
    this.group.add(this.light);

    scene.add(this.group);
    this._t = Math.random() * 10;
    this._age = 0;
  }

  addLog() {
    if (this.isMain || this.out) return;
    this.fuelSeconds += SECONDS_PER_LOG;
  }

  update(dt) {
    this._t += dt;
    this._age += dt;
    // Gentle flicker.
    const flicker = 0.85 + Math.sin(this._t * 13) * 0.08 + Math.sin(this._t * 4.3) * 0.05;
    const ignite = Math.min(1, this._age / IGNITE_RAMP_SECONDS);
    this.light.intensity = (this.isMain ? 3.2 : 2.6) * (this.out ? 0 : flicker) * ignite;
    this.flame.scale.setScalar(this.out ? 0.0001 : flicker * ignite);

    if (!this.isMain && !this.out) {
      this.fuelSeconds -= dt;
      if (this.fuelSeconds <= 0) {
        this.fuelSeconds = 0;
        this.out = true;
      }
    }
  }

  // Turns this fire's dynamic shadow on/off. Cheap to call every frame —
  // three.js just skips the shadow-map render pass for this light when off.
  setShadowCaster(enabled) {
    this.light.castShadow = enabled;
  }

  distanceTo(x, z) {
    const dx = this.x - x;
    const dz = this.z - z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  remove(scene) {
    scene.remove(this.group);
  }
}
