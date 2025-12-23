// Constellation Architect — Phase 3
// A lightweight, branchy constellation tree that grants synergistic bonuses.
// - Player earns Constellation Points over time (see compute.js)
// - Spend points to unlock stars (nodes) in a dependency graph
//
// NOTE: Positions are normalized (0..1) for easy rendering in any container.

export const CONSTELLATIONS = [
  // Root
  {
    id: "root_dusk",
    name: "Dusk's First Spark",
    desc: "The sky remembers your name. Unlocks the constellation map.",
    cost: 1,
    req: [],
    pos: { x: 0.5, y: 0.15 },
    links: ["ember_hearth", "guiding_star"],
  },

  // MODE STARS (Phase 4): Unlockable playstyle "stances"
  // These are mutually exclusive once activated (see state.constellations.active).
  {
    id: "mode_hunter",
    name: "Hunter",
    desc: "Intervention. Omens become more potent, but the Veil thickens.",
    cost: 2,
    req: ["root_dusk"],
    pos: { x: 0.25, y: 0.22 },
    links: ["guiding_star"],
    kind: "mode",
  },
  {
    id: "mode_shepherd",
    name: "Shepherd",
    desc: "Stewardship. Followers grow and stabilize, but outputs are steadier, not spiky.",
    cost: 2,
    req: ["root_dusk"],
    pos: { x: 0.5, y: 0.24 },
    links: ["dusk_seed"],
    kind: "mode",
  },
  {
    id: "mode_oracle",
    name: "Oracle",
    desc: "Remembrance. Constellation points and starlight deepen, but rituals yield fewer Omens.",
    cost: 2,
    req: ["root_dusk"],
    pos: { x: 0.75, y: 0.22 },
    links: ["orbit_warden"],
    kind: "mode",
  },

  // Left branch (Village care)
  {
    id: "ember_hearth",
    name: "Ember Hearth",
    desc: "The village gathers around a steady flame. Prosperity grows faster.",
    cost: 2,
    req: ["root_dusk"],
    pos: { x: 0.28, y: 0.33 },
    links: ["harvest_ring", "sanctuary_lane"],
  },
  {
    id: "harvest_ring",
    name: "Harvest Ring",
    desc: "Fields align with the heavens. Farms are more effective.",
    cost: 3,
    req: ["ember_hearth"],
    pos: { x: 0.18, y: 0.55 },
    links: [],
  },
  {
    id: "sanctuary_lane",
    name: "Sanctuary Lane",
    desc: "Shelter multiplies faith. Followers grow faster when near cap.",
    cost: 3,
    req: ["ember_hearth"],
    pos: { x: 0.36, y: 0.55 },
    links: [],
  },

  // Right branch (Sky + omens)
  {
    id: "guiding_star",
    name: "Guiding Star",
    desc: "Omens carry farther. Village clicks grant more Omens.",
    cost: 2,
    req: ["root_dusk"],
    pos: { x: 0.72, y: 0.33 },
    links: ["chorus_lines", "orbit_warden"],
  },
  {
    id: "chorus_lines",
    name: "Chorus Lines",
    desc: "The sky sings. Veil recedes slightly (reveals more sky).",
    cost: 3,
    req: ["guiding_star"],
    pos: { x: 0.62, y: 0.55 },
    links: [],
  },
  {
    id: "orbit_warden",
    name: "Warden of Orbits",
    desc: "Starlight resonates. Clicking the sky yields more Starlight.",
    cost: 3,
    req: ["guiding_star"],
    pos: { x: 0.82, y: 0.55 },
    links: ["crown_of_night"],
  },

  // Converging capstone
  {
    id: "crown_of_night",
    name: "Crown of Night",
    desc: "A higher order returns. Global output increases.",
    cost: 5,
    req: ["orbit_warden"],
    pos: { x: 0.72, y: 0.78 },
    links: [],
  },
];

export function unlockedSet(unlockedArray) {
  const s = new Set();
  (unlockedArray || []).forEach((id) => s.add(id));
  return s;
}

export function canUnlock(node, unlockedArray, points) {
  const u = unlockedSet(unlockedArray);
  if (u.has(node.id)) return false;
  if ((points || 0) < (node.cost || 0)) return false;
  for (const r of node.req || []) if (!u.has(r)) return false;
  return true;
}

// Apply constellation bonuses to computed stats.
export function applyConstellationBonuses(state, base) {
  const u = unlockedSet(state?.constellations?.unlocked || []);
  const out = { ...base };

  // Phase 4: Mode star (mutually exclusive stance)
  const activeMode = state?.constellations?.active || null;
  if (activeMode === "mode_hunter") {
    // More Omens and click potency, but slightly higher veil pressure.
    out.omenRate *= 1.35;
    out.villageClickMult *= 1.15;
    out.veil = Math.min(1, out.veil * 1.06);
  } else if (activeMode === "mode_shepherd") {
    // More follower capacity and stability.
    out.cap *= 1.25;
    out.devotionRate *= 1.08;
    out.veil = Math.max(0.08, out.veil * 0.97);
  } else if (activeMode === "mode_oracle") {
    // Faster constellation growth and brighter sky, but fewer Omens from rituals.
    out.constellationPointRate *= 1.35;
    out.starlightBonus *= 1.18;
    out.omenRate *= 0.9;
    out.veil = Math.max(0.08, out.veil * 0.95);
  }

  const prosperity = state?.village?.prosperity || 0;

  if (u.has("ember_hearth")) {
    out.prosperityRate *= 1.35;
  }
  if (u.has("harvest_ring")) {
    // Farms increase follower growth + devotion per follower indirectly
    out.followerRate *= 1 + 0.06 * (state?.village?.farms || 0);
  }
  if (u.has("sanctuary_lane")) {
    // Extra growth when near cap (simulated as small multiplier; readable & stable)
    const cap = out.cap || 1;
    const followers = state?.followers || 0;
    const nearCap = cap > 0 ? Math.max(0, Math.min(1, followers / cap)) : 0;
    out.followerRate *= 1 + 0.25 * nearCap;
  }

  if (u.has("guiding_star")) {
    out.omenClickGain *= 1.25;
  }
  if (u.has("chorus_lines")) {
    // Pull veil down slightly; never below the hard clamp in compute
    out.veil = Math.max(0.08, out.veil * 0.94);
  }
  if (u.has("orbit_warden")) {
    // We don't directly compute click yield in compute; we expose a click multiplier
    out.skyClickMult *= 1.35;
  }
  if (u.has("crown_of_night")) {
    out.globalMul *= 1.12;
    // Prosperity synergy: make high prosperity a little more valuable
    out.devotionRate *= 1 + Math.min(0.25, prosperity / 400);
  }

  return out;
}
