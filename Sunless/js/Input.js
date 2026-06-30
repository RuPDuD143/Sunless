// js/Input.js
// Pointer lock + keyboard/mouse state. Other modules read `Input.keys`,
// `Input.mouseDX/DY` (reset each frame by main.js), and listen to the
// onClick/onInteract callbacks.

export const Input = {
  keys: Object.create(null),
  mouseDX: 0,
  mouseDY: 0,
  locked: false,
  leftDown: false,
};

let clickCallback = null;
let interactCallback = null;
let tabCallback = null;

export function initInput(canvas) {
  canvas.addEventListener("click", () => {
    if (!Input.locked) canvas.requestPointerLock();
  });

  document.addEventListener("pointerlockchange", () => {
    Input.locked = document.pointerLockElement === canvas;
  });

  document.addEventListener("mousemove", (e) => {
    if (!Input.locked) return;
    Input.mouseDX += e.movementX || 0;
    Input.mouseDY += e.movementY || 0;
  });

  document.addEventListener("mousedown", (e) => {
    if (!Input.locked) return;
    if (e.button === 0) {
      Input.leftDown = true;
      if (clickCallback) clickCallback();
    }
  });
  document.addEventListener("mouseup", (e) => {
    if (e.button === 0) Input.leftDown = false;
  });

  document.addEventListener("keydown", (e) => {
    Input.keys[e.code] = true;
    if (e.code === "KeyE" && interactCallback) interactCallback();
    if (e.code === "Tab") {
      e.preventDefault();
      if (tabCallback) tabCallback();
    }
  });
  document.addEventListener("keyup", (e) => {
    Input.keys[e.code] = false;
  });
}

export function consumeMouseDelta() {
  const d = { dx: Input.mouseDX, dy: Input.mouseDY };
  Input.mouseDX = 0;
  Input.mouseDY = 0;
  return d;
}

export function onClick(cb) {
  clickCallback = cb;
}
export function onInteract(cb) {
  interactCallback = cb;
}
export function onTab(cb) {
  tabCallback = cb;
}
