// js/Player.js
// Local player: first-person camera control, movement with simple tree
// collision, health/darkness-damage, inventory, and a first-person arm
// for axe swings (since this is FPS, we don't see our own full body).

import * as THREE from "three";
import { Input, consumeMouseDelta } from "./Input.js";
import { clamp } from "./utils.js";
import { MAIN_FIRE_RADIUS } from "./LightNetwork.js";

const MOVE_SPEED = 4.2;
const SPRINT_MULT = 1.5;
const LOOK_SENSITIVITY = 0.0022;
const MAX_HEALTH = 100;
const DARKNESS_DPS = 6; // damage per second while unlit
const LIGHT_REGEN_PS = 3; // slow regen while safely lit
const PAIN_FLASH_RISE_SECONDS = 0.8; // sustained damage ramps the red edges to full over this long
const PAIN_FLASH_DECAY_SECONDS = 0.65; // and fades them out over this long once safe
const CHOP_COOLDOWN = 0.45;
const CHOP_RANGE = 2.4;
const PLAYER_RADIUS = 0.35;

// Keeps a comfortable margin inside the main fire's actual radius so a
// spawned/respawned player is never accidentally placed at the edge of
// (or just outside) the light, regardless of future radius tuning.
function randomSpawnNearMainFire() {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.max(1, MAIN_FIRE_RADIUS - 1) * (0.4 + Math.random() * 0.5);
  const x = Math.cos(angle) * r;
  const z = Math.sin(angle) * r;
  return { x, z, yaw: Math.atan2(x, z) }; // yaw faces back toward the fire
}

export class Player {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;

    const spawn = randomSpawnNearMainFire();
    this.position = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.yaw = spawn.yaw;
    this.pitch = 0;

    this.health = MAX_HEALTH;
    this.alive = true;
    this.inDarkness = false;
    this.painFlash = 0; // 0..1, drives the red damage-edge vignette

    this.inventory = { logs: 0 };

    this.chopCooldown = 0;
    this.swingT = 0;
    this.swinging = false;

    this._buildArm();
  }

  _buildArm() {
    this.armGroup = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.9 });
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), skin);
    arm.position.set(0.32, -0.42, -0.55);
    arm.rotation.x = 0.4;
    this.armGroup.add(arm);

    const handleMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 });
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), handleMat);
    handle.position.set(0.32, -0.66, -0.85);
    handle.rotation.x = 1.1;
    this.armGroup.add(handle);

    // Axe head: a dark socket block where it grips the handle, plus a
    // blade made of two adjoining slabs that flare wider as they move
    // away from the socket — a simple blocky "hatchet" silhouette that
    // reads clearly from any angle, matching the low-poly box style used
    // everywhere else (avatar heads, torsos, etc.).
    const axeHead = new THREE.Group();
    axeHead.position.set(0.32, -0.42, -1.08);
    axeHead.rotation.set(1.1, 0, 0.15);
    this.armGroup.add(axeHead);

    const socketMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.6 });
    const socket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.08), socketMat);
    axeHead.add(socket);

    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xc7c7cf,
      metalness: 0.75,
      roughness: 0.3,
    });
    const bladeInner = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.16), bladeMat);
    bladeInner.position.set(0, 0, 0.14);
    axeHead.add(bladeInner);

    const bladeOuter = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.26), bladeMat);
    bladeOuter.position.set(0, 0, 0.29);
    axeHead.add(bladeOuter);

    this.axeMesh = axeHead;
    this.camera.add(this.armGroup);
    this.scene.add(this.camera);
  }

  respawn() {
    this.health = MAX_HEALTH;
    this.alive = true;
    this.painFlash = 0;
    const spawn = randomSpawnNearMainFire();
    this.position.set(spawn.x, 0, spawn.z);
    this.yaw = spawn.yaw;
    this.pitch = 0;
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.health = clamp(this.health - amount, 0, MAX_HEALTH);
    if (this.health <= 0) {
      this.alive = false;
    }
  }

  tryChop(trees) {
    if (this.chopCooldown > 0) return null;
    this.chopCooldown = CHOP_COOLDOWN;
    this.swinging = true;
    this.swingT = 0;

    // Find nearest tree within range and roughly in front of the player.
    let best = null;
    let bestD = CHOP_RANGE;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    for (const t of trees) {
      if (t.felled) continue;
      const d = t.distanceTo(this.position.x, this.position.z);
      if (d > CHOP_RANGE) continue;
      const dx = (t.x - this.position.x) / (d || 1);
      const dz = (t.z - this.position.z) / (d || 1);
      const facing = dx * fx + dz * fz;
      if (facing < 0.4) continue; // must be roughly facing it
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  update(dt, { trees, lightNetwork, camFollow = true } = {}) {
    if (!this.alive) return;

    // --- Look ---
    const { dx, dy } = consumeMouseDelta();
    this.yaw -= dx * LOOK_SENSITIVITY;
    this.pitch = clamp(this.pitch - dy * LOOK_SENSITIVITY, -1.3, 1.3);

    // --- Move ---
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    let mx = 0,
      mz = 0;
    if (Input.keys["KeyW"]) {
      mx += forward.x;
      mz += forward.z;
    }
    if (Input.keys["KeyS"]) {
      mx -= forward.x;
      mz -= forward.z;
    }
    if (Input.keys["KeyD"]) {
      mx += right.x;
      mz += right.z;
    }
    if (Input.keys["KeyA"]) {
      mx -= right.x;
      mz -= right.z;
    }
    const moving = mx !== 0 || mz !== 0;
    this.speed = 0;
    if (moving) {
      const len = Math.sqrt(mx * mx + mz * mz);
      mx /= len;
      mz /= len;
      const sprint = Input.keys["ShiftLeft"] ? SPRINT_MULT : 1;
      const v = MOVE_SPEED * sprint;
      let nx = this.position.x + mx * v * dt;
      let nz = this.position.z + mz * v * dt;

      if (trees) nx = this._resolveTreeCollision(nx, this.position.z, trees, "x");
      if (trees) nz = this._resolveTreeCollision(this.position.x, nz, trees, "z");

      this.position.x = nx;
      this.position.z = nz;
      this.speed = v;
    }

    // --- Darkness damage / regen ---
    if (lightNetwork) {
      this.inDarkness = !lightNetwork.isPositionLit(this.position.x, this.position.z);
      if (this.inDarkness) {
        this.takeDamage(DARKNESS_DPS * dt);
        this.painFlash = Math.min(1, this.painFlash + dt / PAIN_FLASH_RISE_SECONDS);
      } else {
        if (this.health < MAX_HEALTH) {
          this.health = clamp(this.health + LIGHT_REGEN_PS * dt, 0, MAX_HEALTH);
        }
        this.painFlash = Math.max(0, this.painFlash - dt / PAIN_FLASH_DECAY_SECONDS);
      }
    }

    // --- Chop cooldown / swing animation ---
    if (this.chopCooldown > 0) this.chopCooldown -= dt;
    if (this.swinging) {
      this.swingT += dt / CHOP_COOLDOWN;
      const s = Math.sin(Math.min(this.swingT, 1) * Math.PI);
      this.armGroup.rotation.x = -s * 0.9;
      if (this.swingT >= 1) this.swinging = false;
    } else {
      this.armGroup.rotation.x *= 0.8;
    }
    // Idle bob while walking.
    const bob = moving ? Math.sin(performance.now() * 0.012) * 0.02 : 0;

    // --- Apply to camera ---
    if (camFollow) {
      this.camera.position.set(this.position.x, 1.65 + bob, this.position.z);
      this.camera.rotation.order = "YXZ";
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
    }
  }

  _resolveTreeCollision(x, z, trees, axis) {
    for (const t of trees) {
      if (t.felled) continue;
      const minDist = PLAYER_RADIUS + 0.28 * t.scale;
      const dx = x - t.x;
      const dz = z - t.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < minDist && d > 0.0001) {
        // Push back out along this axis only — cheap approximation that
        // still feels fine for sparse forest collision.
        if (axis === "x") return t.x + (dx / d) * minDist;
        return t.z + (dz / d) * minDist;
      }
    }
    return axis === "x" ? x : z;
  }
}
