// Constellation logic (Step 3)
//
// This module is the single source of truth for constellation rules:
// - Reveal conditions (action-based)
// - Purchase requirements (starlight + prereqs)
// - Applying permanent effects to computed values
// - Applying start-of-cycle bonuses after prestige reset
//
// UI should treat state as immutable. All helpers here are pure.

import { CONSTELLATION_NODES } from "./constellationData.js";

export function getNodeById(id) {
  return CONSTELLATION_NODES.find((n) => String(n.id) === String(id)) || null;
}

export function unlockedSet(unlockedArray) {
  const s = new Set();
  (unlockedArray || []).forEach((id) => s.add(String(id)));
  return s;
}

function getAtPath(obj, path) {
  try {
    return String(path)
      .split(".")
      .reduce((acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined), obj);
  } catch {
    return undefined;
  }
}

// --- Reveal (action-based) ---
// A node can be:
// - hidden (not revealed)
// - revealed but not purchased (buyable if requirements met)
// - purchased (unlocked)
//
// The reveal system prevents players from seeing a full shopping list.
// It also enables "wow moments" when a new star appears.

export function isNodeRevealed(node, state) {
  if (!node) return false;
  const u = unlockedSet(state?.constellations?.unlocked || []);
  if (u.has(String(node.id))) return true;

  const reveal = node.reveal;
  if (!reveal) {
    // Default: if it has prereqs, reveal once any prereq is unlocked; otherwise reveal if constellations unlocked.
    const req = node.req || [];
    if (req.length > 0) return req.some((r) => u.has(String(r)));
    return Boolean(state?.unlocked?.constellations);
  }

  const type = reveal.type;
  if (type === "prestige") {
    const count = Number(reveal.count || 1);
    const p = Number(state?.meta?.totalPrestiges || 0);
    return p >= count;
  }

  if (type === "starlight") {
    const min = Number(reveal.min || 1);
    const st = Number(state?.meta?.starlight || 0);
    return st >= min;
  }

  if (type === "path") {
    const v = getAtPath(state, reveal.path);
    return (Number(v) || 0) >= Number(reveal.min || 1);
  }

  if (type === "faith_total") {
    const v = Number(state?.stats?.totalFaithEarned || 0);
    return v >= Number(reveal.min || 0);
  }

  if (type === "passive_embers") {
    const v = Number(state?.stats?.passiveEmbers || 0);
    return v >= Number(reveal.min || 0);
  }

  return false;
}

export function getRevealHint(node) {
  const r = node?.reveal;
  if (!r) return node?.hint || "Restore nearby stars.";
  if (r.type === "prestige") return `Shatter the Sky ${r.count || 1}×`;
  if (r.type === "starlight") return `Hold ${r.min || 1} Starlight`;
  if (r.type === "path") return `Reach ${r.min || 1} ${String(r.path).split(".").slice(-1)[0]}`;
  if (r.type === "faith_total") return `Earn ${r.min || 0} total Faith (this run)`;
  if (r.type === "passive_embers") return `Generate ${r.min || 0} passive Embers (this run)`;
  return "Complete a hidden rite.";
}

// --- Purchase requirements ---
export function canUnlock(node, unlockedArray, starlight, stateForReveal) {
  if (!node) return false;
  const u = unlockedSet(unlockedArray);
  if (u.has(String(node.id))) return false;
  if ((starlight || 0) < (node.cost || 0)) return false;
  const req = node.req || [];
  for (const r of req) if (!u.has(String(r))) return false;
  if (stateForReveal && !isNodeRevealed(node, stateForReveal)) return false;
  return true;
}

export function canUnlockWithReason(nodeId, state) {
  const node = getNodeById(nodeId);
  if (!node) return { ok: false, reason: "missing" };
  const unlocked = state?.constellations?.unlocked || [];
  const starlight = state?.meta?.starlight || 0;
  const u = unlockedSet(unlocked);

  if (u.has(String(node.id))) return { ok: false, reason: "already" };
  if (!isNodeRevealed(node, state)) return { ok: false, reason: "hidden" };
  // Cost can be discounted by certain permanent nodes on the first purchase each cycle.
  const purchasesThisCycle = Number(state?.constellations?.purchasesThisCycle || 0);
  let discount = 0;
  if (purchasesThisCycle === 0) {
    for (const id of u) {
      const n = getNodeById(id);
      const d = Number(n?.effects?.firstNodeDiscount || 0);
      if (d > discount) discount = d;
    }
  }
  const rawCost = Number(node.cost || 0);
  const cost = Math.max(1, rawCost - discount);
  if (starlight < cost) return { ok: false, reason: "cost" };
  const req = node.req || [];
  for (const r of req) if (!u.has(String(r))) return { ok: false, reason: "req" };
  return { ok: true, reason: "ok" };
}

// Purchase a node. Returns new state object; does not mutate input.
export function unlockNode(state, nodeId) {
  const node = getNodeById(nodeId);
  if (!node) return state;

  const starlight = Number(state?.meta?.starlight || 0);
  const unlocked = state?.constellations?.unlocked || [];
  // Validate prereqs + reveal (cost handled below because discounts can apply).
  const u = unlockedSet(unlocked);
  if (u.has(String(node.id))) return state;
  if (!isNodeRevealed(node, state)) return state;
  for (const r of node.req || []) if (!u.has(String(r))) return state;

  // Rule-changing node: "Astral Keystone" (firstNodeDiscount)
  // Applies to the first constellation purchase each cycle.
  const purchasesThisCycle = Number(state?.constellations?.purchasesThisCycle || 0);
  let discount = 0;
  if (purchasesThisCycle === 0) {
    const u = unlockedSet(unlocked);
    for (const id of u) {
      const n = getNodeById(id);
      const d = Number(n?.effects?.firstNodeDiscount || 0);
      if (d > discount) discount = d;
    }
  }

  const rawCost = Number(node.cost || 0);
  const cost = Math.max(1, rawCost - discount);
  if (starlight < cost) return state;

  return {
    ...state,
    meta: {
      ...(state?.meta || {}),
      starlight: Math.max(0, starlight - cost),
    },
    constellations: {
      ...(state?.constellations || {}),
      unlocked: Array.from(new Set([...(unlocked || []), String(node.id)])),
      purchasesThisCycle: purchasesThisCycle + 1,
    },
  };
}

// Apply permanent constellation effects to computed output.
export function applyConstellationBonuses(baseComputed, state) {
  const out = { ...baseComputed };
  const unlocked = unlockedSet(state?.constellations?.unlocked || []);

  let faithRateMult = 1;
  let emberRateMult = 1;
  let emberClickMult = 1;
  let farmConversionBonus = 0;
  let templeFaithMultBonus = 0;

  for (const id of unlocked) {
    const node = getNodeById(id);
    const eff = node?.effects || {};
    if (typeof eff.faithRateMult === "number") faithRateMult *= eff.faithRateMult;
    if (typeof eff.emberRateMult === "number") emberRateMult *= eff.emberRateMult;
    if (typeof eff.emberClickMult === "number") emberClickMult *= eff.emberClickMult;
    if (typeof eff.farmConversionBonus === "number") farmConversionBonus += eff.farmConversionBonus;
    if (typeof eff.templeFaithMultBonus === "number") templeFaithMultBonus += eff.templeFaithMultBonus;
  }

  if (faithRateMult !== 1) {
    if (typeof out.devotionRate === "number") out.devotionRate *= faithRateMult;
    if (typeof out.faithRate === "number") out.faithRate *= faithRateMult;
  }

  if (emberRateMult !== 1 && typeof out.emberRate === "number") {
    out.emberRate *= emberRateMult;
  }

  if (emberClickMult !== 1 && typeof out.emberClickGain === "number") {
    out.emberClickGain *= emberClickMult;
  }

  // Rule/loop shapers (not just +%): inject extra Faith based on village composition.
  const faithUnlocked = Boolean(state?.unlocked?.faith);
  const farms = Number(state?.village?.farms || 0);
  const temples = Number(state?.village?.temples || 0);
  if (faithUnlocked && farmConversionBonus && typeof out.emberRate === "number") {
    const baseTempleMult = 1 + temples * 0.25;
    const extraFromEmbers = out.emberRate * (farms * farmConversionBonus) * baseTempleMult;
    if (typeof out.devotionRate === "number") out.devotionRate += extraFromEmbers;
    if (typeof out.faithRate === "number") out.faithRate += extraFromEmbers;
  }
  if (faithUnlocked && templeFaithMultBonus && temples > 0) {
    const extraMult = 1 + temples * templeFaithMultBonus;
    if (typeof out.devotionRate === "number") out.devotionRate *= extraMult;
    if (typeof out.faithRate === "number") out.faithRate *= extraMult;
  }

  return out;
}

// Apply start-of-cycle bonuses after prestige reset.
export function applyConstellationStartBonuses(freshState) {
  const s = typeof structuredClone === "function"
    ? structuredClone(freshState)
    : JSON.parse(JSON.stringify(freshState));

  const unlocked = unlockedSet(s?.constellations?.unlocked || []);

  // Reset per-cycle counters.
  s.constellations = s.constellations || {};
  s.constellations.purchasesThisCycle = 0;

  for (const id of unlocked) {
    const node = getNodeById(id);
    const eff = node?.effects || {};

    if (typeof eff.startEmbers === "number") {
      s.embers = Number(s.embers || 0) + eff.startEmbers;
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

  // Reset per-cycle purchase tracking (used for cost-discount rules).
  s.constellations = s.constellations || {};
  s.constellations.purchasesThisCycle = 0;

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
