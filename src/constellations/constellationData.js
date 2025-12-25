// Constellation data (Step 3)
//
// Each node:
// - id, name, desc
// - cost: Starlight cost to purchase
// - req: prerequisite node IDs
// - pos: {x,y} within the constellation map (0..1)
// - links: visual links (IDs)
// - reveal: action-based reveal conditions (controls progressive disclosure)
// - effects: data-driven permanent effects applied by constellationLogic.js

export const CONSTELLATION_NODES = [
  {
    id: "root_first_spark",
    name: "First Spark",
    desc: "The night sky remembers. Start each new cycle with +25 Divine Embers.",
    cost: 1,
    req: [],
    // Always revealed once Constellations are unlocked (first prestige)
    reveal: { type: "prestige", count: 1 },
    pos: { x: 0.50, y: 0.16 },
    links: ["ember_wellspring", "belief_rekindled", "sky_scars"],
    effects: { startEmbers: 25 },
  },

  // Left branch: build the village faster
  {
    id: "ember_wellspring",
    name: "Ember Wellspring",
    desc: "Homes glow brighter. Homes generate +30% more Embers.",
    cost: 2,
    req: ["root_first_spark"],
    reveal: { type: "path", path: "village.huts", min: 5 },
    pos: { x: 0.30, y: 0.32 },
    links: ["village_memory", "starlit_tools"],
    effects: { emberRateMult: 1.30 },
  },
  {
    id: "village_memory",
    name: "Village Memory",
    desc: "Your people rebuild faster. Start each new cycle with 1 Home already built.",
    cost: 2,
    req: ["ember_wellspring"],
    reveal: null,
    pos: { x: 0.18, y: 0.50 },
    links: ["starlit_tools"],
    effects: { startHomes: 1 },
  },
  {
    id: "starlit_tools",
    name: "Starlit Tools",
    desc: "Guided hands. Your Channel Power clicks grant +20% more Embers.",
    cost: 2,
    req: ["ember_wellspring"],
    reveal: { type: "passive_embers", min: 120 },
    pos: { x: 0.30, y: 0.64 },
    links: ["harvest_conduit"],
    effects: { emberClickMult: 1.20 },
  },
  {
    id: "harvest_conduit",
    name: "Harvest Conduit",
    desc: "Farms channel Ember-flow more efficiently. +1% extra Ember→Faith conversion.",
    cost: 3,
    req: ["starlit_tools"],
    reveal: { type: "path", path: "village.farms", min: 2 },
    pos: { x: 0.42, y: 0.82 },
    links: ["sanctum_foundation"],
    effects: { farmConversionBonus: 0.01 },
  },

  // Center branch: accelerate Faith / devotion
  {
    id: "belief_rekindled",
    name: "Belief Rekindled",
    desc: "Faith returns faster. Faith is unlocked immediately in new cycles and Home-faith trickle is stronger.",
    cost: 2,
    req: ["root_first_spark"],
    reveal: { type: "path", path: "unlocked.faith", min: 1 },
    pos: { x: 0.50, y: 0.40 },
    links: ["chorus_of_stars", "sanctum_foundation"],
    effects: { unlockFaithOnCycleStart: true, faithRateMult: 1.10 },
  },
  {
    id: "chorus_of_stars",
    name: "Chorus of Stars",
    desc: "Devotion harmonizes. Gain +12% more Faith from all sources.",
    cost: 3,
    req: ["belief_rekindled"],
    reveal: { type: "faith_total", min: 60 },
    pos: { x: 0.62, y: 0.58 },
    links: ["echo_of_ashes"],
    effects: { faithRateMult: 1.12 },
  },
  {
    id: "echo_of_ashes",
    name: "Echo of Ashes",
    desc: "You remember the last end. Gain +5% Faith per Prestige completed (caps at +25%).",
    cost: 4,
    req: ["chorus_of_stars"],
    reveal: { type: "prestige", count: 2 },
    pos: { x: 0.70, y: 0.78 },
    links: [],
    effects: { /* dynamic: handled via compute hooks later; kept as a Step 3 placeholder */ },
    hint: "Shatter the Sky again.",
  },

  // Right branch: prestige efficiency / sky path
  {
    id: "sky_scars",
    name: "Sky Scars",
    desc: "Each shattering leaves a path. Gain +25% more Starlight from Prestige.",
    cost: 3,
    req: ["root_first_spark"],
    reveal: { type: "prestige", count: 1 },
    pos: { x: 0.72, y: 0.32 },
    links: ["firmament_thread"],
    effects: { starlightGainMult: 1.25 },
  },
  {
    id: "firmament_thread",
    name: "Firmament Thread",
    desc: "The veil thins. Unlock the Sky tab sooner (after Constellations) and boost Faith from Temples by +5%.",
    cost: 4,
    req: ["sky_scars"],
    reveal: { type: "prestige", count: 2 },
    pos: { x: 0.86, y: 0.50 },
    links: ["astral_keystone"],
    effects: { templeFaithMultBonus: 0.05 },
  },
  {
    id: "astral_keystone",
    name: "Astral Keystone",
    desc: "A stable anchor. Your first constellation unlock each cycle costs 1 less Starlight (min cost 1).",
    cost: 5,
    req: ["firmament_thread"],
    reveal: { type: "prestige", count: 3 },
    pos: { x: 0.82, y: 0.68 },
    links: [],
    effects: { firstNodeDiscount: 1 },
    hint: "Prestige three times.",
  },

  // Temple gate
  {
    id: "sanctum_foundation",
    name: "Sanctum Foundation",
    desc: "Temples resonate with starlight. Temples multiply Faith slightly more.",
    cost: 3,
    req: ["belief_rekindled"],
    reveal: { type: "path", path: "village.temples", min: 1 },
    pos: { x: 0.38, y: 0.56 },
    links: ["harvest_conduit"],
    effects: { templeFaithMultBonus: 0.05 },
  },
];
