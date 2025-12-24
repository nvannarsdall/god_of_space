const LS_KEY = "space_god_incremental_v6_preview";

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function fmt(n) {
  if (!Number.isFinite(n)) return "∞";
  if (n < 1000) return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0);
  const units = ["K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
  let u = -1;
  let v = n;
  while (v >= 1000 && u < units.length - 1) {
    v /= 1000;
    u++;
  }
  return `${v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0)}${units[u]}`;
}

function deepMerge(base, incoming) {
  const out = JSON.parse(JSON.stringify(base));
  const merge = (a, b) => {
    Object.keys(b || {}).forEach((k) => {
      if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k])) {
        a[k] = a[k] || {};
        merge(a[k], b[k]);
      } else {
        a[k] = b[k];
      }
    });
  };
  merge(out, incoming || {});
  return out;
}

function baseState() {
  return {
    t: 0,
    seed: Math.floor(Math.random() * 1e9),

    meta: {
      cycles: 0,
      memory: 0,
    },

    followers: 0,
    devotion: 0, // Reverence
    power: 0, // Authority

    whispers: 0, // Omens (pre-awakening)
    stardust: 0, // Starlight bucket

    constellations: {
      unlocked: [],
      points: 0,
      active: null,
    },

    village: {
      prosperity: 0,
      faith: 1,
      huts: 0,
      farms: 0,
      temples: 0,
      shrines: 0,
      festivals: 0,
      council: 0,
    },
    sky: { starsong: 0, orbits: 0, telescope: 0, transcend: 0, crown: 0 },

    // short-lived boosts; values are in "t" seconds
    buffs: {
      portentUntil: 0,
    },

    unlocked: { awakened: false, convert: false, sky: false },
    ui: {
      tutorialHidden: true,
      tab: "village",
      screen: "menu",
      tutorialStep: 0,
      tutorialActive: false,
      introSeen: false,
    },

    settings: {
      autosave: true,
      reducedMotion: false,
      musicEnabled: false,
      musicVolume: 0.65,
    },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(s) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

function migrateState(s) {
  const next = JSON.parse(JSON.stringify(s));

  // critical bug fix: if you have followers, you're awakened
  if (next.followers >= 1) next.unlocked.awakened = true;

  // unlock convert once temples exist
  if ((next.village?.temples || 0) >= 1) next.unlocked.convert = true;

  // unlock sky once temples are raised or you have sky upgrades
  if ((next.village?.temples || 0) > 0 || (next.sky?.starsong || 0) > 0)
    next.unlocked.sky = true;

  // sanity
  next.followers = Math.max(0, next.followers);
  next.devotion = Math.max(0, next.devotion);
  next.power = Math.max(0, next.power);
  next.whispers = Math.max(0, next.whispers);
  next.stardust = Math.max(0, next.stardust);

  next.village = Object.assign(
    { huts: 0, farms: 0, temples: 0, shrines: 0, festivals: 0, council: 0 },
    next.village || {}
  );
  next.sky = Object.assign(
    { starsong: 0, orbits: 0, telescope: 0, transcend: 0, crown: 0 },
    next.sky || {}
  );
  next.unlocked = Object.assign(
    { awakened: false, convert: false, sky: false },
    next.unlocked || {}
  );

  next.buffs = Object.assign({ portentUntil: 0 }, next.buffs || {});

  next.constellations = Object.assign(
    { unlocked: [], points: 0 },
    next.constellations || {}
  );
  next.ui = Object.assign(
    {
      // Keep tutorial non-invasive by default.
      // (Some prior versions accidentally defaulted tutorialActive=true,
      // which could soft-lock first-load or suppress the intro.)
      tutorialHidden: true,
      tab: "village",
      screen: "menu",
      tutorialStep: 0,
      tutorialActive: false,
      introSeen: false,
    },
    next.ui || {}
  );
  next.meta = Object.assign({ cycles: 0, memory: 0 }, next.meta || {});

  next.settings = Object.assign(
    {
      autosave: true,
      reducedMotion: false,
      musicEnabled: false,
      musicVolume: 0.65,
    },
    next.settings || {}
  );

  return next;
}

export {
  LS_KEY,
  baseState,
  clamp,
  deepMerge,
  fmt,
  loadState,
  migrateState,
  saveState,
};
