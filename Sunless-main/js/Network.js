// js/Network.js
// All Firebase Realtime Database read/write lives here. Other modules
// never touch `db` directly — they call these functions and register
// callbacks for incoming updates.

import {
  ref,
  set,
  update,
  onValue,
  onDisconnect,
  remove,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db, authReady, myUid } from "./firebaseConfig.js";

const PLAYER_WRITE_INTERVAL_MS = 100;
export const PLAYER_FIRE_FUEL_MS = 10 * 60 * 1000;
export const LOG_FUEL_BONUS_MS = 45 * 1000;

let uid = null;
let writeTimer = null;

export async function initNetwork() {
  uid = await authReady;
  // Remove our player node automatically if the tab closes / connection drops.
  onDisconnect(ref(db, `players/${uid}`)).remove();
  return uid;
}

export function getMyUid() {
  return uid;
}

// ---------- Players ----------

export function startPlayerSync(getStateFn) {
  if (writeTimer) clearInterval(writeTimer);
  writeTimer = setInterval(() => {
    if (!uid) return;
    const s = getStateFn();
    set(ref(db, `players/${uid}`), {
      name: s.name,
      x: s.x,
      y: s.y,
      z: s.z,
      yaw: s.yaw,
      pitch: s.pitch,
      health: s.health,
      chopping: s.chopping,
      color: s.color,
      t: Date.now(),
    });
  }, PLAYER_WRITE_INTERVAL_MS);
}

export function onPlayersUpdate(callback) {
  onValue(ref(db, "players"), (snap) => {
    const val = snap.val() || {};
    delete val[uid];
    callback(val);
  });
}

// ---------- Trees ----------

export function syncTreeChop(treeId, chops, felled) {
  update(ref(db, `world/trees/${treeId}`), { chops, felled });
}

export function onTreesUpdate(callback) {
  onValue(ref(db, "world/trees"), (snap) => {
    callback(snap.val() || {});
  });
}

// ---------- Campfires ----------

export function createCampfire(id, x, z, ownerName) {
  set(ref(db, `world/campfires/${id}`), {
    x,
    z,
    ownerName,
    createdAt: Date.now(),
    expiresAt: Date.now() + PLAYER_FIRE_FUEL_MS,
  });
}

export function addLogToCampfire(id) {
  const fireRef = ref(db, `world/campfires/${id}/expiresAt`);
  runTransaction(fireRef, (current) => {
    const base = current && current > Date.now() ? current : Date.now();
    return base + LOG_FUEL_BONUS_MS;
  });
}

export function onCampfiresUpdate(callback) {
  onValue(ref(db, "world/campfires"), (snap) => {
    callback(snap.val() || {});
  });
}

export function removeCampfire(id) {
  remove(ref(db, `world/campfires/${id}`));
}
