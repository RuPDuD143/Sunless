// js/main.js
// Entry point. Boots Three.js + Firebase, builds the forest, and runs the
// game loop. Keeps orchestration only — actual systems live in their own
// files (see Player.js, LightNetwork.js, Campfire.js, Tree.js, Avatar.js,
// Network.js, HUD.js, Crafting.js, Input.js).

import * as THREE from "three";
import { createSceneSetup } from "./sceneSetup.js";
import { buildGround, generateTreeLayout } from "./world.js";
import { Tree } from "./Tree.js";
import { Avatar } from "./Avatar.js";
import { Player } from "./Player.js";
import { LightNetwork } from "./LightNetwork.js";
import { Campfire } from "./Campfire.js";
import { initInput, onClick, onInteract } from "./Input.js";
import { updateHUD, setInteractPrompt, setBlindAmount } from "./HUD.js";
import { initCrafting } from "./Crafting.js";
import { uid as makeId } from "./utils.js";
import {
  initNetwork,
  startPlayerSync,
  onPlayersUpdate,
  syncTreeChop,
  onTreesUpdate,
  createCampfire,
  addLogToCampfire,
  onCampfiresUpdate,
} from "./Network.js";

// ---------- Scene / world setup ----------

const { renderer, scene, camera } = createSceneSetup();
buildGround(scene);

const treeLayout = generateTreeLayout();
const trees = treeLayout.map((d) => new Tree(scene, d));
const treesById = new Map(trees.map((t) => [t.id, t]));

const lightNetwork = new LightNetwork();
const mainFire = new Campfire(scene, { id: "main", x: 0, z: 0, isMain: true });
const campfires = new Map([["main", mainFire]]);

const player = new Player(camera, scene);

initInput(document.getElementById("game-canvas"));

// ---------- Remote players ----------

const remoteAvatars = new Map(); // uid -> Avatar
const myColor = 0x3366aa + Math.floor(Math.random() * 0x445566);
let myName = "Wanderer";

function colorForUid(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const hue = (h % 360) / 360;
  return new THREE.Color().setHSL(hue, 0.55, 0.55).getHex();
}

// ---------- HUD / Crafting ----------

const crafting = initCrafting({
  getLogs: () => player.inventory.logs,
  onCraftCampfire: (cost) => {
    player.inventory.logs -= cost;
    const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const x = player.position.x + fwd.x * 2;
    const z = player.position.z + fwd.z * 2;
    const id = "fire-" + makeId();
    const fire = new Campfire(scene, { id, x, z, isMain: false });
    campfires.set(id, fire);
    lightNetwork.addSource({ id, x, z, radius: fire.radius, lit: true });
    createCampfire(id, x, z, myName);
  },
});

// ---------- Interact (add log to a nearby fire) ----------

let nearbyFireId = null;

onInteract(() => {
  if (!nearbyFireId) return;
  const fire = campfires.get(nearbyFireId);
  if (!fire || fire.out || player.inventory.logs <= 0) return;
  player.inventory.logs -= 1;
  fire.addLog();
  addLogToCampfire(nearbyFireId);
});

onClick(() => {
  if (!player.alive) return;
  const tree = player.tryChop(trees);
  if (!tree) return;
  const result = tree.chop();
  if (result.felled) {
    player.inventory.logs += result.logs;
  }
  syncTreeChop(tree.id, tree.chops, tree.felled);
});

document.getElementById("respawn-btn").addEventListener("click", () => {
  player.respawn();
});

// ---------- Menu / boot ----------

const menuOverlay = document.getElementById("menu-overlay");
const hud = document.getElementById("hud");
const nameInput = document.getElementById("name-input");
const playBtn = document.getElementById("play-btn");

let gameStarted = false;
let isBlind = false;
let blindAmount = 0; // smoothed 0..1, eased toward isBlind each frame
const BLIND_TRANSITION_SECONDS = 0.7;

playBtn.addEventListener("click", async () => {
  myName = (nameInput.value || "Wanderer").trim().slice(0, 16) || "Wanderer";
  menuOverlay.classList.add("hidden");
  hud.classList.remove("hidden");
  document.getElementById("game-canvas").requestPointerLock();

  if (!gameStarted) {
    gameStarted = true;
    await bootNetworking();
  }
});

// ---------- Networking wiring ----------

async function bootNetworking() {
  await initNetwork();

  startPlayerSync(() => ({
    name: myName,
    x: player.position.x,
    y: player.position.y,
    z: player.position.z,
    yaw: player.yaw,
    pitch: player.pitch,
    health: player.health,
    chopping: player.swinging,
    color: myColor,
  }));

  onPlayersUpdate((others) => {
    const seen = new Set();
    for (const [id, data] of Object.entries(others)) {
      seen.add(id);
      let av = remoteAvatars.get(id);
      if (!av) {
        av = new Avatar(scene, data.color || colorForUid(id));
        remoteAvatars.set(id, av);
      }
      av.targetPos = { x: data.x, y: data.y, z: data.z };
      av.setLook(data.yaw || 0, data.pitch || 0);
      av._lastSpeed =
        Math.hypot((av._lastX ?? data.x) - data.x, (av._lastZ ?? data.z) - data.z) / 0.1;
      av._lastX = data.x;
      av._lastZ = data.z;
    }
    // Remove avatars for players who left.
    for (const id of [...remoteAvatars.keys()]) {
      if (!seen.has(id)) {
        remoteAvatars.get(id).remove(scene);
        remoteAvatars.delete(id);
      }
    }
  });

  onTreesUpdate((data) => {
    for (const [id, t] of Object.entries(data)) {
      const tree = treesById.get(id);
      if (tree) tree.applyRemoteState(t.chops || 0, !!t.felled);
    }
  });

  onCampfiresUpdate((data) => {
    for (const [id, f] of Object.entries(data)) {
      if (id === "main") continue;
      let fire = campfires.get(id);
      if (!fire) {
        fire = new Campfire(scene, { id, x: f.x, z: f.z, isMain: false });
        campfires.set(id, fire);
        lightNetwork.addSource({ id, x: f.x, z: f.z, radius: fire.radius, lit: true });
      }
      const remaining = Math.max(0, (f.expiresAt - Date.now()) / 1000);
      fire.fuelSeconds = remaining;
      fire.out = remaining <= 0;
      lightNetwork.setLit(id, !fire.out);
    }
  });
}

// ---------- Game loop ----------

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);

  if (gameStarted) {
    player.update(dt, { trees, lightNetwork });

    for (const t of trees) t.update(dt);
    for (const [id, f] of campfires) {
      f.update(dt);
      if (id !== "main") lightNetwork.setLit(id, !f.out);
    }

    // Position + animate remote avatars (positions arrive pre-smoothed
    // enough at 10/s for a small-scale forest game; swap in lerp here if
    // you add interpolation later).
    for (const av of remoteAvatars.values()) {
      if (av.targetPos) {
        av.setPosition(av.targetPos.x, av.targetPos.y, av.targetPos.z);
      }
      av.update(dt, av._lastSpeed || 0);
    }

    // Nearby non-main, non-out fire for the interact prompt.
    nearbyFireId = null;
    for (const [id, f] of campfires) {
      if (id === "main" || f.out) continue;
      if (f.distanceTo(player.position.x, player.position.z) < 2.2) {
        nearbyFireId = id;
        break;
      }
    }
    if (nearbyFireId && player.inventory.logs > 0) {
      setInteractPrompt("Press E to feed the fire a log (+45s)");
    } else if (nearbyFireId) {
      setInteractPrompt("Need a log to feed this fire");
    } else {
      setInteractPrompt(null);
    }

    // --- Visibility: only the fire cluster the player is currently
    // standing inside (and anything within reach of it) gets drawn. A
    // fire that's lit but unconnected to that cluster — even the eternal
    // main fire — is hidden entirely. Standing in no fire's radius at
    // all means an empty cluster: total blackout, handled below.
    const myCluster = lightNetwork.getClusterContaining(player.position.x, player.position.z);
    isBlind = myCluster.size === 0;

    const blindTarget = isBlind ? 1 : 0;
    const blindStep = dt / BLIND_TRANSITION_SECONDS;
    blindAmount =
      blindAmount < blindTarget
        ? Math.min(blindTarget, blindAmount + blindStep)
        : Math.max(blindTarget, blindAmount - blindStep);
    setBlindAmount(blindAmount);

    for (const [id, f] of campfires) {
      f.group.visible = myCluster.has(id);
    }
    for (const t of trees) {
      const visibleNow = lightNetwork.isVisibleInCluster(t.x, t.z, myCluster);
      if (t._wasVisible === undefined) {
        t._wasVisible = visibleNow; // baseline on first frame — no flash at boot
      } else if (visibleNow && !t._wasVisible) {
        t.triggerFlash();
      }
      t._wasVisible = visibleNow;
      t.group.visible = visibleNow;
    }
    for (const av of remoteAvatars.values()) {
      if (av.targetPos) {
        av.root.visible = lightNetwork.isVisibleInCluster(av.targetPos.x, av.targetPos.z, myCluster);
      }
    }

    updateHUD(player);
  }

  renderer.render(scene, camera);
}

animate();
