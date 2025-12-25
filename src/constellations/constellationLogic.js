// Constellation logic (Step 2D)
// This file contains all non-visual rules for:
// - Unlock requirements / costs
// - Applying permanent effects to computed values
// - Applying start-of-cycle bonuses after prestige reset
//
// Step 3 can replace the UI with a constellation map without changing this logic.

import { CONSTELLATION_NODES } from "./constellationData";

export function getNodeById(id) {
  return CONSTELLATION_NODES.find((n) => String(n.id) === String(id)) || null;
}

export function unlockedSet(unlockedArray) {
  const s = new Set();
  (unlockedArray || []).forEach((id) => s.add(String(id)));
  return s;
}

export function canUnlock(node, unlockedArray, starlight) {
  if (!node) return false;
  const u = unlockedSet(unlockedArray);
  if (u.has(node.id)) return false;
  if ((starlight || 0) < (node.cost || 0)) return false;
  const req = node.req || [];
  for (const r of req) if (!u.has(String(r))) return false;
  return true;
}

// Pure helper: returns { ok, reason } to support future UI.
export function canUnlockWithReason(nodeId, state) {
  const node = getNodeById(nodeId);
  if (!node) return { ok: false, reason: "missing" };
  const unlocked = state?.constellations?.unlocked || [];
  const starlight = state?.meta?.starlight || 0;
  const u = unlockedSet(unlocked);

  if (u.has(node.id)) return { ok: false, reason: "already" };
  if (starlight < (node.cost || 0)) return { ok: false, reason: "cost" };
  const req = node.req || [];
  for (const r of req) if (!u.has(String(r))) return { ok: false, reason: "req" };
  return { ok: true, reason: "ok" };
}

// Purchase (unlock) a node. Returns new state object; does not mutate the input.
export function unlockNode(state, nodeId) {
  const node = getNodeById(nodeId);
  if (!node) return state;

  const starlight = state?.meta?.starlight || 0;
  const unlocked = state?.constellations?.unlocked || [];
  if (!canUnlock(node, unlocked, starlight)) return state;

  return {
    ...state,
    meta: {
      ...(state?.meta || {}),
      starlight: Math.max(0, starlight - (node.cost || 0)),
    },
    constellations: {
      ...(state?.constellations || {}),
      unlocked: [...unlocked, node.id],
    },
  };
}

// Apply permanent constellation effects to the computed output.
// NOTE: This should stay pure and not touch React/UI.
export function applyConstellationBonuses(baseComputed, state) {
  const out = { ...baseComputed };
  const unlocked = unlockedSet(state?.constellations?.unlocked || []);

  // Gather effects from unlocked nodes (data-driven for Step 3 compatibility).
  let faithRateMult = 1;
  for (const id of unlocked) {
    const node = getNodeById(id);
    const eff = node?.effects || {};
    if (typeof eff.faithRateMult === "number") faithRateMult *= eff.faithRateMult;
  }

  if (faithRateMult !== 1) {
    // compute.js exposes devotionRate as both faithRate and devotionRate.
    if (typeof out.devotionRate === "number") out.devotionRate *= faithRateMult;
    if (typeof out.faithRate === "number") out.faithRate *= faithRateMult;
  }

  return out;
}

// Apply start-of-cycle bonuses after a prestige reset.
// This should be called exactly once, immediately after the run-state reset.
export function applyConstellationStartBonuses(freshState) {
  // Use structured cloning fallback to avoid accidental mutation of nested objects.
  const s = typeof structuredClone === "function"
    ? structuredClone(freshState)
    : JSON.parse(JSON.stringify(freshState));

  const unlocked = unlockedSet(s?.constellations?.unlocked || []);

  for (const id of unlocked) {
    const node = getNodeById(id);
    const eff = node?.effects || {};

    if (typeof eff.startEmbers === "number") {
      s.embers = (s.embers || 0) + eff.startEmbers;
    }

    if (typeof eff.startHomes === "number") {
      s.village = s.village || {};
      s.village.huts = Math.max(eff.startHomes, s.village.huts || 0);
    }

    if (eff.unlockFaithOnCycleStart) {
      s.unlocked = s.unlocked || {};
      s.unlocked.faith = true;
    }
  }

  return s;
}

// Helper for prestige: starlight gain multiplier from unlocked nodes.
export function getStarlightGainMultiplier(state) {
  const unlocked = unlockedSet(state?.constellations?.unlocked || []);
  let mult = 1;
  for (const id of unlocked) {
    const node = getNodeById(id);
    const eff = node?.effects || {};
    if (typeof eff.starlightGainMult === "number") mult *= eff.starlightGainMult;
  }
  return mult;
}
