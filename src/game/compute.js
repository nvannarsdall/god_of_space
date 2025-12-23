import { clamp } from "./state";
import { applyConstellationBonuses } from "../constellations/constellations";

function compute(s) {
  const huts = s.village.huts || 0;
  const farms = s.village.farms || 0;
  const temples = s.village.temples || 0;
  const shrines = s.village.shrines || 0;
  const festivals = s.village.festivals || 0;
  const council = s.village.council || 0;

  const starsong = s.sky.starsong || 0;
  const orbits = s.sky.orbits || 0;
  const telescope = s.sky.telescope || 0;
  const transcend = s.sky.transcend || 0;
  const crown = s.sky.crown || 0;

  // === FOLLOWER CAP ===
  let cap = 12 + huts * 6 + council * 25;
  cap *= 1 + transcend * 0.08;

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

  // === REVERENCE (Devotion) DECAY — Phase 2 ===
  // Reverence is unstable unless supported by village structures.
  // This creates meaningful tension so the player must invest in stability.
  const devotionDecayRate = s.unlocked.awakened
    ? (() => {
        const support = 1 + 0.14 * temples + 0.08 * shrines + 0.1 * festivals;
        const veilNow = clamp(1 - starsong * 0.09, 0.08, 1);
        const veilPressure = 1 + 0.1 * veilNow;
        // Small baseline + scales gently with current stored devotion
        const base = 0.06 + 0.0022 * (s.devotion || 0);
        return (base * veilPressure) / support;
      })()
    : 0;

  // Net devotion rate (can go negative if decay exceeds gain)
  devotionRate = devotionRate - devotionDecayRate;

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
  const withBonuses = applyConstellationBonuses(s, {
    cap,
    followerRate,
    devotionRate,
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
  });

  return withBonuses;
}

export { compute };
