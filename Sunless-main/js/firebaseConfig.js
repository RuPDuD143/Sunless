// js/firebaseConfig.js
// Firebase init only. Other modules import `db` and `authReady` from here.
//
// NOTE: this game uses anonymous auth so every browser tab gets a stable
// uid for the session. In the Firebase console, enable
// Authentication -> Sign-in method -> Anonymous, and make sure your
// Realtime Database rules allow authenticated read/write, e.g.:
//
// {
//   "rules": {
//     ".read": "auth != null",
//     ".write": "auth != null"
//   }
// }

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD322jV9Zm0NerKgD0nXr0KitkBenHr5BQ",
  authDomain: "rupdud-db6e6.firebaseapp.com",
  databaseURL: "https://rupdud-db6e6-default-rtdb.firebaseio.com",
  projectId: "rupdud-db6e6",
  storageBucket: "rupdud-db6e6.firebasestorage.app",
  messagingSenderId: "100904012012",
  appId: "1:100904012012:web:86ae7b7bcaffdaf9a93dc9",
  measurementId: "G-WRFZWXCNX8",
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

export let myUid = null;

export const authReady = new Promise((resolve) => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      myUid = user.uid;
      resolve(user.uid);
    } else {
      signInAnonymously(auth).catch((err) => {
        console.error("Anonymous sign-in failed:", err);
        // Fall back to a local-only random id so the game still runs
        // offline / without auth configured, just without sync.
        myUid = "local-" + Math.random().toString(36).slice(2, 10);
        resolve(myUid);
      });
    }
  });
});
