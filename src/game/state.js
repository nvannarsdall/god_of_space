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

    followers: 0,
    devotion: 0, // Reverence
    power: 0, // Authority

    whispers: 0, // Omens (pre-awakening)
    stardust: 0, // Starlight bucket

    village: { huts: 0, farms: 0, temples: 0, festivals: 0, council: 0 },
    sky: { starsong: 0, orbits: 0, telescope: 0, transcend: 0, crown: 0 },

    unlocked: { awakened: false, convert: false, sky: false },
    ui: {
      tutorialHidden: false,
      tab: "village",
      screen: "menu",
      tutorialStep: 0,
      tutorialActive: true,
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
  const allowedTabs = ["village", "sky", "codex"];

  // critical bug fix: if you have followers, you're awakened
  if (next.followers >= 1) next.unlocked.awakened = true;

  // unlock convert once temples exist
  if ((next.village?.temples || 0) >= 1) next.unlocked.convert = true;

  // unlock sky once you have authority or sky upgrades
  if (next.power > 0 || (next.sky?.starsong || 0) > 0) next.unlocked.sky = true;

  // sanity
  next.followers = Math.max(0, next.followers);
  next.devotion = Math.max(0, next.devotion);
  next.power = Math.max(0, next.power);
  next.whispers = Math.max(0, next.whispers);
  next.stardust = Math.max(0, next.stardust);

  next.village = Object.assign(
    { huts: 0, farms: 0, temples: 0, festivals: 0, council: 0 },
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
  next.ui = Object.assign(
    {
      tutorialHidden: false,
      tab: "village",
      screen: "menu",
      tutorialStep: 0,
      tutorialActive: true,
    },
    next.ui || {}
  );
  if (!allowedTabs.includes(next.ui.tab)) {
    next.ui.tab = "village";
  }
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
