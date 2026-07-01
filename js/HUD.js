// js/HUD.js
// Pure DOM update helpers, called every frame from main.js with the
// current player/game state. No game logic lives here.

const healthFill = document.getElementById("health-bar-fill");
const healthText = document.getElementById("health-text");
const darknessWarning = document.getElementById("darkness-warning");
const vignette = document.getElementById("vignette-dark");
const blackoutIris = document.getElementById("blackout-iris");
const painVignette = document.getElementById("pain-vignette");
const logsCount = document.getElementById("count-logs");
const deathScreen = document.getElementById("death-screen");
const interactPrompt = document.getElementById("interact-prompt");

export function updateHUD(player) {
  const pct = Math.round(player.health);
  healthFill.style.width = pct + "%";
  healthText.textContent = pct;

  darknessWarning.classList.toggle("hidden", !player.inDarkness);
  vignette.classList.toggle("active", player.inDarkness);

  logsCount.textContent = player.inventory.logs;

  deathScreen.classList.toggle("hidden", player.alive);

  painVignette.style.opacity = player.painFlash || 0;
}

// blindAmount: 0 = fully sighted, 1 = fully blind. Smoothly shrinks the
// clear circle of the iris rather than snapping straight to black.
export function setBlindAmount(blindAmount) {
  const openRadius = (1 - blindAmount) * 150; // percent
  const innerStop = Math.max(0, openRadius - 15);
  blackoutIris.style.background =
    `radial-gradient(circle at center, transparent ${innerStop}%, #000 ${openRadius}%)`;
}

export function setInteractPrompt(text) {
  if (!text) {
    interactPrompt.classList.add("hidden");
    return;
  }
  interactPrompt.textContent = text;
  interactPrompt.classList.remove("hidden");
}
