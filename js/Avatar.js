// js/Avatar.js
// A Minecraft-esque blocky character: box head (turns with look direction),
// box torso, swinging box arms/legs while moving. Used to render every
// *other* player. The local player instead sees first-person arms
// (see Player.js) since this is an FPS view.

import * as THREE from "three";

export class Avatar {
  constructor(scene, color = 0x4488cc) {
    this.root = new THREE.Group();

    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.9 });
    const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x33415c, roughness: 0.9 });

    // Torso
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.28), shirt);
    this.torso.position.y = 1.05;
    this.torso.castShadow = true;
    this.root.add(this.torso);

    // Head pivot sits at the neck so it can rotate cleanly.
    this.headPivot = new THREE.Group();
    this.headPivot.position.y = 1.45;
    this.root.add(this.headPivot);

    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), skin);
    this.head.position.y = 0.225;
    this.head.castShadow = true;
    this.headPivot.add(this.head);

    // Simple face hint (front-facing) so "look direction" is legible.
    const faceMat = new THREE.MeshStandardMaterial({ color: 0x3a2a20 });
    const eyeGeo = new THREE.BoxGeometry(0.06, 0.06, 0.02);
    const eyeL = new THREE.Mesh(eyeGeo, faceMat);
    eyeL.position.set(-0.1, 0.25, -0.23);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.1;
    this.headPivot.add(eyeL, eyeR);

    // Arms (pivoted at the shoulder for swing animation)
    this.armL = this._limb(0.16, 0.55, 0.16, shirt, -0.33, 1.32);
    this.armR = this._limb(0.16, 0.55, 0.16, shirt, 0.33, 1.32);
    // Legs (pivoted at the hip)
    this.legL = this._limb(0.18, 0.6, 0.18, pants, -0.13, 0.68);
    this.legR = this._limb(0.18, 0.6, 0.18, pants, 0.13, 0.68);

    this.root.add(this.armL.pivot, this.armR.pivot, this.legL.pivot, this.legR.pivot);

    // Simple campfire-glow style name tag billboard could be added by HUD;
    // out of scope for the 3D mesh itself.

    scene.add(this.root);

    this._walkPhase = 0;
  }

  _limb(w, h, d, mat, x, pivotY) {
    const pivot = new THREE.Group();
    pivot.position.set(x, pivotY, 0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.y = -h / 2;
    mesh.castShadow = true;
    pivot.add(mesh);
    return { pivot, mesh };
  }

  setPosition(x, y, z) {
    this.root.position.set(x, y, z);
  }

  // yaw: full body + head turn left/right. pitch: head tilt up/down only.
  setLook(yaw, pitch) {
    this.root.rotation.y = yaw;
    this.headPivot.rotation.x = pitch * 0.6;
  }

  // speed: 0 = idle, >0 scales swing amplitude/rate.
  update(dt, speed) {
    if (speed > 0.05) {
      this._walkPhase += dt * Math.min(speed, 6) * 1.8;
      const swing = Math.sin(this._walkPhase) * Math.min(0.9, 0.3 + speed * 0.08);
      this.armL.pivot.rotation.x = swing;
      this.armR.pivot.rotation.x = -swing;
      this.legL.pivot.rotation.x = -swing;
      this.legR.pivot.rotation.x = swing;
    } else {
      // Ease back to rest pose.
      this.armL.pivot.rotation.x *= 0.85;
      this.armR.pivot.rotation.x *= 0.85;
      this.legL.pivot.rotation.x *= 0.85;
      this.legR.pivot.rotation.x *= 0.85;
    }
  }

  setChopping(active) {
    // Quick visual nudge so a remote player's axe swing reads clearly,
    // layered on top of the walk animation via an offset.
    this._chopping = active;
  }

  remove(scene) {
    scene.remove(this.root);
  }
}
