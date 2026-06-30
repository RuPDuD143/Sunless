// js/Player.js
// Local player: first-person camera control, movement with simple tree
// collision, health/darkness-damage, inventory, and a first-person arm
// for axe swings (since this is FPS, we don't see our own full body).

import * as THREE from "three";
import { Input, consumeMouseDelta } from "./Input.js";
import { clamp } from "./utils.js";

const MOVE_SPEED = 4.2;
const SPRINT_MULT = 1.5;
const LOOK_SENSITIVITY = 0.0022;
const MAX_HEALTH = 100;
const DARKNESS_DPS = 6; // damage per second while unlit
const LIGHT_REGEN_PS = 3; // slow regen while safely lit
const CHOP_COOLDOWN = 0.45;
const CHOP_RANGE = 2.4;
const PLAYER_RADIUS = 0.35;

export class Player {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;

    this.position = new THREE.Vector3(0, 0, 6);
    this.yaw = Math.PI; // facing toward the main campfire at origin
    this.pitch = 0;

    this.health = MAX_HEALTH;
    this.alive = true;
    this.inDarkness = false;

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

    const handleMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.55, 6), handleMat);
    handle.position.set(0.32, -0.66, -0.85);
    handle.rotation.x = 1.1;
    this.armGroup.add(handle);

    // Axe head: a wedge-shaped blade (extruded 2D outline) plus a small
    // dark socket box where it grips the handle, so it actually reads as
    // an axe instead of a flat plank.
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, -0.06);
    bladeShape.lineTo(0.05, -0.02);
    bladeShape.lineTo(0.22, 0.06);
    bladeShape.lineTo(0.27, 0.2);
    bladeShape.lineTo(0.16, 0.3);
    bladeShape.lineTo(0.02, 0.18);
    bladeShape.lineTo(0, 0.05);
    bladeShape.closePath();
    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.035,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 1,
    });
    bladeGeo.center();
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xc7c7cf,
      metalness: 0.75,
      roughness: 0.3,
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(0.32, -0.42, -1.08);
    blade.rotation.set(1.1, 0, 0.15);

    const socketMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.6 });
    const socket = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.05), socketMat);
    socket.position.set(0.32, -0.5, -1.0);
    socket.rotation.x = 1.1;

    this.armGroup.add(socket, blade);
    this.axeMesh = blade;
    this.camera.add(this.armGroup);
    this.scene.add(this.camera);
  }

  respawn() {
    this.health = MAX_HEALTH;
    this.alive = true;
    this.position.set(0, 0, 6 + Math.random() * 2);
    this.yaw = Math.PI;
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
      } else if (this.health < MAX_HEALTH) {
        this.health = clamp(this.health + LIGHT_REGEN_PS * dt, 0, MAX_HEALTH);
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
