// js/Crafting.js
// Wires up the crafting panel DOM. Pure UI glue — the actual "spend logs,
// spawn a campfire" logic lives in the onCraftCampfire callback supplied
// by main.js, which has access to the player/world state.

const CAMPFIRE_COST = 12; // 4 trees * 3 logs/tree — craftable from one tree run

export function initCrafting({ getLogs, onCraftCampfire }) {
  const toggleBtn = document.getElementById("craft-toggle-btn");
  const panel = document.getElementById("craft-panel");
  const recipeBtn = document.querySelector("#craft-campfire .recipe-btn");

  let open = false;
  function setOpen(v) {
    open = v;
    panel.classList.toggle("hidden", !open);
    refreshAffordability();
  }

  toggleBtn.addEventListener("click", () => setOpen(!open));

  function refreshAffordability() {
    const logs = getLogs();
    recipeBtn.disabled = logs < CAMPFIRE_COST;
  }

  recipeBtn.addEventListener("click", () => {
    if (getLogs() < CAMPFIRE_COST) return;
    onCraftCampfire(CAMPFIRE_COST);
    refreshAffordability();
  });

  return {
    refreshAffordability,
    close: () => setOpen(false),
    toggle: () => setOpen(!open),
    CAMPFIRE_COST,
  };
}
