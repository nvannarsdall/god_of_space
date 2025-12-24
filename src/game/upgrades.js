function upgradeCost(base, growth, lvl) {
  return base * Math.pow(growth, lvl);
}

const VILLAGE_UPGRADES = [
  {
    id: "huts",
    name: "Homes",
    desc: "Shelter the village. Homes gather faint divine remnants as Divine Embers.",
    baseCost: 25,
    growth: 1.17,
    currency: "embers",
    effect: (lvl) => `Divine Embers +${(0.05 * (lvl)).toFixed(2)}/s`,
  },
  {
    id: "farms",
    name: "Farms",
    desc: "Food surplus: faster growth and higher faith yield.",
    baseCost: 85,
    growth: 1.19,
    currency: "faith",
    effect: (lvl) =>
      `Growth +${(0.11 * (lvl + 1)).toFixed(2)}/s, Faith +${Math.round(
        (lvl + 1) * 2
      )}%`,
  },
  {
    id: "temples",
    name: "Temples",
    desc: "Ritual focus: faith deepens. Unlocks conversion.",
    baseCost: 260,
    growth: 1.22,
    currency: "faith",
    effect: (lvl) => `Faith +${Math.round((lvl + 1) * 8)}%, unlock Convert`,
  },
  {
    id: "shrines",
    name: "Shrines",
    desc: "Small altars that drink the dusk. Generates Omens passively.",
    baseCost: 170,
    growth: 1.2,
    currency: "faith",
    effect: (lvl) => `Omens +${(0.05 * (lvl + 1)).toFixed(2)}/s`,
  },
  {
    id: "festivals",
    name: "Festivals",
    desc: "Rapture spreads: more Omens from rituals and occasional faith surges.",
    baseCost: 620,
    growth: 1.23,
    currency: "faith",
    effect: (lvl) =>
      `Omens/click +${Math.round((lvl + 1) * 6)}%, surges +${Math.round(
        (lvl + 1) * 3
      )}%`,
  },
  {
    id: "council",
    name: "Council",
    desc: "Order in the dark: increases follower cap significantly.",
    baseCost: 1200,
    growth: 1.26,
    currency: "faith",
    effect: (lvl) => `Cap +${Math.round((lvl + 1) * 25)}`,
  },
];

const SKY_UPGRADES = [
  {
    id: "starsong",
    name: "Starsong",
    desc: "Peel back the Veil: constellations become real.",
    baseCost: 40,
    growth: 1.22,
    currency: "stardust",
    effect: (lvl) => `Veil -${Math.round((lvl + 1) * 9)}%`,
  },
  {
    id: "orbits",
    name: "Orbits",
    desc: "Mechanize the heavens: starlight gathers faster.",
    baseCost: 125,
    growth: 1.24,
    currency: "stardust",
    effect: (lvl) => `Starlight +${Math.round((lvl + 1) * 8)}%`,
  },
  {
    id: "telescope",
    name: "Telescope",
    desc: "Sky clicks yield more starlight.",
    baseCost: 230,
    growth: 1.25,
    currency: "stardust",
    effect: (lvl) => `Sky click +${Math.round((lvl + 1) * 12)}%`,
  },
  {
    id: "transcend",
    name: "Transcend",
    desc: "The void yields: raises caps and stabilizes growth.",
    baseCost: 520,
    growth: 1.27,
    currency: "stardust",
    effect: (lvl) => `Cap +${Math.round((lvl + 1) * 8)}%`,
  },
  {
    id: "crown",
    name: "Crown of Night",
    desc: "Rule the dusk: increases global output.",
    baseCost: 1100,
    growth: 1.29,
    currency: "stardust",
    effect: (lvl) => `All +${Math.round((lvl + 1) * 5)}%`,
  },
];

export { SKY_UPGRADES, VILLAGE_UPGRADES, upgradeCost };
