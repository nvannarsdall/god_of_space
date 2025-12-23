import { clamp } from "./state";

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

  // === PROSPERITY (NEW ACTIVE LOOP) ===
  const prosperityRate = s.unlocked.awakened
    ? 0.02 * s.followers + 0.05 * temples + 0.04 * festivals
    : 0;

  // === DEVOTION PER FOLLOWER ===
  let devotionPerFollower = 0.55;
  devotionPerFollower *= 1 + farms * 0.02;
  devotionPerFollower *= 1 + temples * 0.08;
  devotionPerFollower *= 1 + crown * 0.05;

  // Prosperity feeds devotion (Divine Caretaker loop)
  devotionPerFollower *= 1 + clamp(s.village.prosperity / 100, 0, 2);

  const surgeChance = clamp(festivals * 0.03, 0, 0.45);
  const surgeMult = 1 + festivals * 0.1;
  const surgeEV = 1 + surgeChance * (surgeMult - 1);

  const globalMul = 1 + crown * 0.05;
  let devotionRate = s.unlocked.awakened
    ? s.followers * devotionPerFollower * surgeEV * globalMul
    : 0;

  // === OMENS ===
  const omenRate = s.unlocked.awakened
    ? (0.05 * shrines + 0.01 * festivals) * globalMul
    : 0;
  const omenClickGain =
    (1 + 0.06 * festivals + 0.02 * shrines) * (0.9 + 0.1 * globalMul);

  const veil = clamp(1 - starsong * 0.09, 0.08, 1);
  const starlightBonus = 1 + orbits * 0.08;
  const telescopeBonus = 1 + telescope * 0.12;

  // === PORTENT BUFF ===
  const portentActive = (s.buffs?.portentUntil || 0) > (s.t || 0);
  const portentMul = portentActive ? 1.45 : 1;
  followerRate *= portentMul;
  devotionRate *= portentMul;
  const finalProsperityRate = prosperityRate * portentMul;

  return {
    cap,
    followerRate,
    devotionRate,
    prosperityRate: finalProsperityRate,
    omenRate,
    omenClickGain,
    veil,
    starlightBonus,
    telescopeBonus,
    globalMul,
    portentActive,
  };
}

export { compute };
