import { clamp } from "./state";

function compute(s) {
  const huts = s.village.huts || 0;
  const farms = s.village.farms || 0;
  const temples = s.village.temples || 0;
  const festivals = s.village.festivals || 0;
  const council = s.village.council || 0;

  const starsong = s.sky.starsong || 0;
  const orbits = s.sky.orbits || 0;
  const telescope = s.sky.telescope || 0;
  const transcend = s.sky.transcend || 0;
  const crown = s.sky.crown || 0;

  let cap = 12 + huts * 6 + council * 25;
  cap *= 1 + transcend * 0.08;

  // follower growth: only after awakened AND huts>=1
  const growthAdd = huts >= 1 ? 0.07 + huts * 0.07 + farms * 0.11 : 0;
  const pressure = cap <= 0 ? 1 : clamp(1 - s.followers / cap, 0, 1);
  const followerRate =
    s.unlocked.awakened && huts >= 1 ? growthAdd * (0.2 + 0.8 * pressure) : 0;

  // devotion/reverence per follower
  let devotionPerFollower = 0.55;
  devotionPerFollower *= 1 + farms * 0.02;
  devotionPerFollower *= 1 + temples * 0.08;
  devotionPerFollower *= 1 + crown * 0.05;

  const surgeChance = clamp(festivals * 0.03, 0, 0.45);
  const surgeMult = 1 + festivals * 0.1;
  const surgeEV = 1 + surgeChance * (surgeMult - 1);

  const globalMul = 1 + crown * 0.05;
  const devotionRate = s.unlocked.awakened
    ? s.followers * devotionPerFollower * surgeEV * globalMul
    : 0;

  let convertEff = 0.02;
  convertEff *= 1 + temples * 0.02;
  convertEff *= 1 + orbits * 0.07;

  const veil = clamp(1 - starsong * 0.09, 0.08, 1);
  const telescopeBonus = 1 + telescope * 0.12;

  const clickDevotionBonus = 0.35 + temples * 0.03 + festivals * 0.01;
  const clickFestivalMul = 1 + festivals * 0.06;

  return {
    cap,
    followerRate,
    devotionRate,
    convertEff,
    veil,
    telescopeBonus,
    clickDevotionBonus,
    clickFestivalMul,
    globalMul,
  };
}

export { compute };
