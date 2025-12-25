import { clamp } from "./state.js";
import {
  applyConstellationBonuses,
  getStarlightGainMultiplier,
} from "../constellations/constellations.js";
// Prestige currency (Starlight) is earned on "Shatter the Sky" and persists across cycles.
// We base gain on total Faith earned this run (not current Faith, which can be spent).
function computeStarlightGain(s) {
  const totalFaith =
    typeof s?.stats?.totalFaithEarned === "number"
      ? s.stats.totalFaithEarned
      : typeof s?.faith === "number"
      ? s.faith
      : typeof s?.devotion === "number"
      ? s.devotion
      : 0;

  // Step 2C pacing:
  // - First Prestige should be reachable in ~15–25 minutes.
  // - We gate Starlight until a meaningful amount of Faith has been earned.
  // - Curve is tunable without touching save state.
  if (totalFaith < 15) return 0;

  const F0 = 30; // Faith needed for ~1 Starlight on first prestige
  const power = 0.58;

  const base = Math.floor(Math.pow(totalFaith / F0, power));
  if (base <= 0) return 0;

  // Constellations: data-driven Starlight gain multiplier (e.g., "Sky Scars").
  const mult = getStarlightGainMultiplier(s);
  return Math.max(1, Math.floor(base * mult));
}

// Step 2C UX: provide "next at" guidance for the Objective HUD & prestige panel.
// Returns the next total Faith earned (this run) at which Starlight gain increases.
function computeNextStarlightFaith(s) {
  const totalFaith =
    typeof s?.stats?.totalFaithEarned === "number"
      ? s.stats.totalFaithEarned
      : typeof s?.faith === "number"
      ? s.faith
      : typeof s?.devotion === "number"
      ? s.devotion
      : 0;

  const cur = computeStarlightGain(s);
  // If we haven't reached the first gate, show the first meaningful target.
  if (totalFaith < 15) return 15;

  // Brute force to the next +1 gain; this runs rarely (HUD/panel), so it's fine.
  // Cap search to avoid infinite loops if formulas change.
  const maxSeek = Math.max(1200, Math.ceil(totalFaith * 6));
  for (let f = Math.ceil(totalFaith) + 1; f <= maxSeek; f++) {
    const nextState = {
      ...s,
      stats: { ...(s?.stats || {}), totalFaithEarned: f },
    };
    if (computeStarlightGain(nextState) > cur) return f;
  }
  return null;
}

function compute(s) {
  const huts = s.village.huts || 0;
  const farms = s.village.farms || 0;
  const temples = s.village.temples || 0;
  const shrines = s.village.shrines || 0;
  const festivals = s.village.festivals || 0;
  const council = s.village.council || 0;

  const storedFaith =
    typeof s.faith === "number"
      ? s.faith
      : typeof s.devotion === "number"
      ? s.devotion
      : 0;
  const starsong = s.sky.starsong || 0;
  const orbits = s.sky.orbits || 0;
  const telescope = s.sky.telescope || 0;
  const transcend = s.sky.transcend || 0;
  const crown = s.sky.crown || 0;

  // === FOLLOWER CAP ===
  let cap = 12 + huts * 6 + council * 25;
  cap *= 1 + transcend * 0.08;

  // === DIVINE EMBERS (Phase B early loop) ===
  // Early-game pacing: Homes should matter as a first purchase.
  // 0.10 Ember/sec per Home keeps passive relevant without making clicking obsolete.
  const emberRate = Math.max(0, huts * 0.1);

  // Click gain (Phase C pacing): mild early boost that gently soft-diminishes after ~50 Embers.
  // App.jsx clamps click gains to >= 1, so we keep this always >= 1.
  const clickSoftCap = 50;
  const clickDiminish =
    (s.embers || 0) <= clickSoftCap
      ? 1
      : Math.max(0.35, clickSoftCap / Math.max(1, s.embers || 0));
  const emberClickGain = 1 + 0.5 * clickDiminish;

  // === FOLLOWER GROWTH ===
  const growthAdd = huts >= 1 ? 0.07 + huts * 0.07 + farms * 0.11 : 0;
  const pressure = cap <= 0 ? 1 : clamp(1 - s.followers / cap, 0, 1);
  let followerRate =
    s.unlocked.awakened && huts >= 1 ? growthAdd * (0.2 + 0.8 * pressure) : 0;

  // === PROSPERITY LOOP ===
  const prosperityRate = s.unlocked.awakened
    ? 0.02 * s.followers + 0.05 * temples + 0.04 * festivals
    : 0;

  // === DEVOTION PER FOLLOWER ===
  let devotionPerFollower = 0.55;
  devotionPerFollower *= 1 + farms * 0.02;
  devotionPerFollower *= 1 + temples * 0.08;
  devotionPerFollower *= 1 + crown * 0.05;

  devotionPerFollower *= 1 + clamp((s.village?.prosperity || 0) / 100, 0, 2);

  const surgeChance = clamp(festivals * 0.03, 0, 0.45);
  const surgeMult = 1 + festivals * 0.1;
  const surgeEV = 1 + surgeChance * (surgeMult - 1);

  const memory = s.meta?.memory || 0;
  let globalMul = (1 + crown * 0.05) * (1 + memory * 0.05);
  let devotionRate = s.unlocked.awakened
    ? s.followers * devotionPerFollower * surgeEV * globalMul
    : 0;

  // === PHASE C: EMBERS → FAITH TRANSITION ===
  // After Faith unlock, establish a meaningful income path:
  // - Homes provide a tiny baseline Faith trickle
  // - Farms convert a portion of Ember flow into Faith
  // - Temples multiply all Faith gains (they are amplifiers, not the only source)
  const faithUnlocked = !!s.unlocked?.faith;

  // Tiny baseline Faith trickle so the Embers → Faith transition never feels stalled.
  const faithFromHomes = faithUnlocked ? huts * 0.0035 : 0;

  const baseConversion = 0.02; // 2.0% of Ember/sec
  const farmBonus = farms * 0.01; // +1% per Farm
  const conversionRate = faithUnlocked ? baseConversion + farmBonus : 0;
  const faithFromEmbers = faithUnlocked ? emberRate * conversionRate : 0;

  const templeFaithMult = faithUnlocked ? 1 + temples * 0.25 : 1;

  devotionRate =
    (devotionRate + faithFromHomes + faithFromEmbers) * templeFaithMult;

  // === REVERENCE (Devotion) DECAY — disabled ===
  // The current design spine (Embers → Faith → Prestige Starlight) does not include
  // a "numbers go down" decay mechanic. We keep this slot for a possible later
  // challenge layer, but it is intentionally disabled for now.

  // === OMENS ===
  let omenRate = s.unlocked.awakened
    ? (0.05 * shrines + 0.01 * festivals) * globalMul
    : 0;
  let omenClickGain =
    (1 + 0.06 * festivals + 0.02 * shrines) * (0.9 + 0.1 * globalMul);

  // === SKY ===
  let veil = clamp(1 - starsong * 0.09, 0.08, 1);
  let starlightBonus = 1 + orbits * 0.08;
  let telescopeBonus = 1 + telescope * 0.12;

  // Click multipliers exposed to App click handlers
  let skyClickMult = 1;
  let villageClickMult = 1;

  // === PORTENT BUFF ===
  const portentActive = (s.buffs?.portentUntil || 0) > (s.t || 0);
  const portentMul = portentActive ? 1.45 : 1;
  followerRate *= portentMul;
  devotionRate *= portentMul;
  omenRate *= portentMul;
  omenClickGain *= portentMul;
  const finalProsperityRate = prosperityRate * portentMul;

  // === CONSTELLATION POINTS (Phase 3) ===
  // Slow, steady trickle that scales with devotion & starlight activity.
  // (This is intentionally gentle; node costs are small.)
  const cycles = s.meta?.cycles || 0;
  const constellationPointRate = s.unlocked.awakened
    ? clamp(devotionRate / 1800, 0, 2.5) +
      0.01 +
      0.005 * temples +
      cycles * 0.01
    : 0;

  // Apply constellation bonuses (branching synergies)
  let withBonuses = {
    cap,
    followerRate,
    devotionRate,
    faithRate: devotionRate,
    emberRate,
    devotionDecayRate,
    prosperityRate: finalProsperityRate,
    omenRate,
    omenClickGain,
    veil,
    starlightBonus,
    telescopeBonus,
    globalMul,
    skyClickMult,
    villageClickMult,
    portentActive,
    constellationPointRate,
  };

  // Phase B: constellations are a later-layer system; don't apply bonuses until the sky layer is unlocked.
  if (s.unlocked?.sky || (s.constellations?.unlocked || []).length > 0) {
    withBonuses = applyConstellationBonuses(s, withBonuses);
  }

  return withBonuses;
}

export { compute, computeStarlightGain, computeNextStarlightFaith };