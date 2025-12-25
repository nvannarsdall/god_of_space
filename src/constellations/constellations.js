// Constellations — compatibility wrapper (Step 2D)
// Step 2B introduced constellation nodes and effects in this file.
// Step 2D separates data (constellationData.js) from logic (constellationLogic.js)
// so Step 3 can swap in a star-map UI without rewriting gameplay rules.

export { CONSTELLATION_NODES as CONSTELLATIONS } from "./constellationData.js";
export {
  getNodeById,
  unlockedSet,
  canUnlock,
  canUnlockWithReason,
  unlockNode,
  applyConstellationBonuses,
  applyConstellationStartBonuses,
  getStarlightGainMultiplier,
} from "./constellationLogic.js";
