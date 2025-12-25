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
      starlight: 0,
      totalPrestiges: 0,
      discoveredTabs: {
        village: true,
        faith: false,
        sky: false,
        stardust: false,
        constellations: false,
      },
    },

    followers: 0,
    faith: 0, // Faith (Phase C)
    devotion: 0, // legacy key (was Reverence)
    power: 0, // Authority

    embers: 0, // Divine Embers (Phase B early-game)

    whispers: 0, // Omens (pre-awakening)
    stardust: 0, // Starlight bucket

    constellations: {
      unlocked: [],
      points: 0, // legacy (unused after Step 2B)
      active: null, // reserved for future modes
      purchasesThisCycle: 0, // Step 3: for rule-changing nodes (e.g., first unlock discount)
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

    unlocked: { awakened: false, faith: false, stardust: false, constellations: false, convert: false, sky: false },
    ui: {
      tutorialHidden: true,
      tab: "village",
      screen: "menu",
      tutorialStep: 0,
      tutorialActive: false,
      introSeen: false,
      started: false,
          settingsOpen: false,
},

    stats: {
      passiveEmbers: 0, // accumulated from passive generation
      totalFaithEarned: 0, // accumulated over this run (for prestige gain)
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

    // Phase B: ensure embers + stats exist
  if (typeof next.embers !== "number") next.embers = 0;
  if (!next.stats || typeof next.stats !== "object") next.stats = {};
  if (typeof next.stats.passiveEmbers !== "number") next.stats.passiveEmbers = 0;

  if (typeof next.stats.totalFaithEarned !== "number") next.stats.totalFaithEarned = 0;

  // Step 3: ensure constellation runtime fields exist
  if (!next.constellations || typeof next.constellations !== "object") next.constellations = { unlocked: [] };
  if (!Array.isArray(next.constellations.unlocked)) next.constellations.unlocked = [];
  if (typeof next.constellations.purchasesThisCycle !== "number") next.constellations.purchasesThisCycle = 0;


  // Prestige meta: ensure starlight + discovered tabs exist
  if (!next.meta || typeof next.meta !== "object") next.meta = {};
  if (typeof next.meta.cycles !== "number") next.meta.cycles = 0;
  if (typeof next.meta.memory !== "number") next.meta.memory = 0;
  if (typeof next.meta.starlight !== "number") next.meta.starlight = 0;
  if (typeof next.meta.totalPrestiges !== "number") next.meta.totalPrestiges = 0;
  if (!next.meta.discoveredTabs || typeof next.meta.discoveredTabs !== "object") next.meta.discoveredTabs = {};
  next.meta.discoveredTabs.village = true;
  if (typeof next.meta.discoveredTabs.constellations !== "boolean") next.meta.discoveredTabs.constellations = false;

  const faithNow =
    typeof next.faith === "number"
      ? next.faith
      : typeof next.devotion === "number"
      ? next.devotion
      : 0;

  // Legacy alias: older saves used unlocked.starlight to gate the (now renamed) Stardust bucket.
  if (next.unlocked?.starlight && !next.unlocked?.stardust) next.unlocked.stardust = true;

  // Stardust (legacy bucket) is now only revealed after the first Prestige / Starlight earned.
  if ((next.meta?.starlight || 0) > 0 || (next.meta?.totalPrestiges || 0) > 0) next.unlocked.stardust = true;

  if (next.unlocked?.faith || faithNow > 0) next.meta.discoveredTabs.faith = true;

  // Strict chapter order: keep Sky as a later chapter.
  // Once the player has prestiged (earned Starlight) we allow Sky to be "discoverable".
  // (The tab can still be locked behind further requirements.)
  if (next.meta.starlight > 0) next.meta.discoveredTabs.starlight = true;
  if (
    next.meta.starlight > 0 ||
    next.unlocked?.constellations ||
    (next.constellations?.unlocked || []).length > 0 ||
    next.unlocked?.sky
  ) {
    next.meta.discoveredTabs.sky = true;
  }
  if (next.unlocked?.constellations || (next.constellations?.unlocked || []).length > 0) next.meta.discoveredTabs.constellations = true;


  // Phase C: ensure Faith exists (alias legacy devotion)
  if (typeof next.faith !== "number") next.faith = typeof next.devotion === "number" ? next.devotion : 0;
  if (typeof next.devotion !== "number") next.devotion = next.faith;

// critical bug fix: if you have followers, you're awakened
  if (next.followers >= 1) next.unlocked.awakened = true;

  // unlock convert once temples exist
  if ((next.village?.temples || 0) >= 1) next.unlocked.convert = true;

  // Unlock Sky as a later chapter: after first Prestige (Starlight earned).
  // This preserves the intended order: Embers → Faith → Starlight → Constellations → Sky.
  if ((next.meta?.starlight || 0) > 0) next.unlocked.sky = true;

    // Phase C unlock order: Faith unlocks after basic shelter is established
  if ((next.village?.huts || 0) >= 3 || (next.embers || 0) >= 50) next.unlocked.faith = true;
// Constellations unlock after the first Prestige (earning Starlight).
  // They are purchased with Starlight and persist across cycles.
  if ((next.meta?.starlight || 0) >= 1 || (next.constellations?.unlocked || []).length > 0) next.unlocked.constellations = true;

  // Constellation: Belief Rekindled makes Faith immediately available in new cycles.
  if ((next.constellations?.unlocked || []).includes("belief_rekindled")) next.unlocked.faith = true;

// sanity
  next.followers = Math.max(0, next.followers);
  next.faith = Math.max(0, next.faith);
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
    { awakened: false, faith: false, stardust: false, constellations: false, convert: false, sky: false },
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
      started: false,
          settingsOpen: false,
},
    next.ui || {}
  );

  // If this save already has progress, consider the session "started" to avoid
  // re-showing the Start Game gate on existing saves (e.g. after migrations).
  if (next.ui.started === false) {
    const hasProgress =
      (next.t || 0) > 0.1 ||
      (next.followers || 0) > 0 ||
      (next.devotion || 0) > 0 ||
      (next.village?.huts || 0) > 0 ||
      (next.village?.farms || 0) > 0 ||
      (next.village?.temples || 0) > 0 ||
      (next.sky?.starsong || 0) > 0 ||
      Boolean(next.ui.introSeen);
    if (hasProgress) next.ui.started = true;
  }

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
