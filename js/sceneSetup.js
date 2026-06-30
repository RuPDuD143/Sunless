// js/sceneSetup.js
// Renderer, camera, scene, base (very dim) ambient lighting.
// Actual light sources (campfires) are added by LightNetwork/Campfire.

import * as THREE from "three";

export function createSceneSetup() {
  const canvas = document.getElementById("game-canvas");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  // The forest is shrouded in darkness; fog hides anything not near a
  // light source, which doubles as cheap "can't see disconnected bright
  // areas" behavior — they're simply past the fog line.
  scene.background = new THREE.Color(0x010102);
  scene.fog = new THREE.FogExp2(0x010102, 0.045);

  const camera = new THREE.PerspectiveCamera(
    72,
    window.innerWidth / window.innerHeight,
    0.05,
    250
  );
  camera.position.set(0, 1.7, 4);

  // Extremely dim ambient so the world isn't pure black where no fire
  // reaches, while still feeling dangerous and unlit.
  const ambient = new THREE.AmbientLight(0x1a2233, 0.18);
  scene.add(ambient);

  // Faint moon-ish directional light, mostly to give silhouettes.
  const moon = new THREE.DirectionalLight(0x445577, 0.12);
  moon.position.set(-30, 40, -20);
  scene.add(moon);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera };
}
