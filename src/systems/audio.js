// Centralized audio authority for God of Space.
//
// Phase A requirements:
// - Autoplay-safe: start muted, only unmute after a user gesture.
// - Single source of truth for background music.
// - Settings-driven enable/volume.
//
// Step 5:
// - Layered music progression with crossfades.
// - Milestone stingers (autoplay-safe) via WebAudio (no extra assets).

let unlocked = false;
let desiredEnabled = true;
let desiredVolume = 0.65;

/** @type {Record<string, HTMLAudioElement>} */
const tracks = Object.create(null);
let currentTrackId = null;
let fadeToken = 0;

// --- utilities ---
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function safePlay(a) {
  try {
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch {}
}

function safePause(a) {
  try {
    a.pause();
  } catch {}
}

function ensureUnlockHandlers() {
  if (typeof window === "undefined") return;
  if (unlocked) return;

  const unlock = () => {
    unlocked = true;
    // Once unlocked, apply settings again (unmutes if enabled).
    applyMusicSettings({ enabled: desiredEnabled, volume: desiredVolume });
    // Also allow WebAudio SFX.
    tryResumeSfx();
  };

  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });
}

function makeTrack(id, url, baseVolume = 0.65) {
  if (typeof Audio === "undefined") return null;
  const a = new Audio(url);
  a.loop = true;
  a.volume = clamp01(baseVolume);
  a.muted = true; // autoplay-safe; unmute after unlock if enabled
  a.preload = "auto";
  // Muted autoplay is generally allowed.
  safePlay(a);
  tracks[id] = a;
  return a;
}

function getTrack(id) {
  if (tracks[id]) return tracks[id];

  switch (id) {
    case "intro":
      return makeTrack("intro", "/assets/audio/god_of_space_theme.wav", 0.65);
    case "village":
      return makeTrack("village", "/assets/audio/nebula_drift.wav", 0.65);
    case "constellations":
      return makeTrack(
        "constellations",
        "/assets/audio/silent_constellations.wav",
        0.65
      );
    default:
      return makeTrack("intro", "/assets/audio/god_of_space_theme.wav", 0.65);
  }
}

function setTrackVolume(id, vol) {
  const a = getTrack(id);
  if (!a) return;
  a.volume = clamp01(vol);
}

function setTrackMuted(id, muted) {
  const a = getTrack(id);
  if (!a) return;
  a.muted = muted;
}

function crossfade(fromId, toId, durationMs = 900) {
  const from = fromId ? getTrack(fromId) : null;
  const to = getTrack(toId);
  if (!to) return;

  // Make sure both are playing (muted for autoplay). We'll unmute in applyMusicSettings.
  safePlay(to);
  if (from) safePlay(from);

  const token = ++fadeToken;
  const start = performance.now();
  const fromStartVol = from ? from.volume : 0;

  // Start target at 0 for a clean fade-in.
  to.volume = 0;

  const tick = () => {
    if (token !== fadeToken) return;
    const now = performance.now();
    const t = clamp01((now - start) / Math.max(1, durationMs));

    // Simple smoothstep
    const tt = t * t * (3 - 2 * t);

    if (from) from.volume = clamp01(fromStartVol * (1 - tt));
    to.volume = clamp01(desiredVolume * tt);

    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      // End: pause the old track to save resources.
      if (from) {
        safePause(from);
        from.currentTime = from.currentTime; // keep continuity if resumed later
      }
    }
  };

  requestAnimationFrame(tick);
}

// --- Public API ---

/**
 * Back-compat: return the currently active music element.
 * (Intro cutscene calls this to "ensure music is running".)
 */
export function getMusic() {
  ensureUnlockHandlers();
  // Ensure at least one track exists.
  if (!currentTrackId) currentTrackId = "intro";
  return getTrack(currentTrackId);
}

/**
 * Apply music settings (enabled/volume). Safe to call often.
 */
export function applyMusicSettings({ enabled, volume }) {
  ensureUnlockHandlers();

  desiredEnabled = Boolean(enabled);
  desiredVolume = Number.isFinite(volume) ? clamp01(volume) : 0.65;

  // Ensure current track exists.
  if (!currentTrackId) currentTrackId = "intro";
  const cur = getTrack(currentTrackId);
  if (!cur) return;

  // Apply volume target to current track. (During crossfade, the fade loop will override gradually.)
  cur.volume = clamp01(cur.volume);

  if (!desiredEnabled) {
    // Pause all tracks; keep their currentTime for continuity.
    Object.keys(tracks).forEach((id) => {
      const a = tracks[id];
      if (!a) return;
      try {
        a.muted = true;
        safePause(a);
      } catch {}
    });
    return;
  }

  // Enabled: keep current track playing.
  safePlay(cur);

  // Muting policy: if unlocked, unmute; else keep muted until user gesture.
  const mute = !unlocked;
  Object.keys(tracks).forEach((id) => {
    setTrackMuted(id, mute);
  });

  // Set current track to target volume (if not mid-crossfade).
  setTrackVolume(currentTrackId, desiredVolume);
}

/**
 * Set the high-level music scene. Crossfades between tracks.
 * scenes: 'intro' | 'village' | 'constellations'
 */
export function setMusicScene(scene) {
  ensureUnlockHandlers();
  const nextId = scene || "intro";
  if (nextId === currentTrackId) return;

  const prev = currentTrackId;
  currentTrackId = nextId;

  // If music disabled, just swap without playing.
  if (!desiredEnabled) {
    getTrack(nextId);
    return;
  }

  // Crossfade.
  crossfade(prev, nextId, 900);

  // Apply muting policy immediately.
  const mute = !unlocked;
  Object.keys(tracks).forEach((id) => setTrackMuted(id, mute));
}

// --- SFX (WebAudio) ---
let sfxCtx = null;
let sfxMaster = null;

function tryResumeSfx() {
  if (typeof window === "undefined") return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!sfxCtx) {
    try {
      sfxCtx = new AC();
      sfxMaster = sfxCtx.createGain();
      sfxMaster.gain.value = 0.9;
      sfxMaster.connect(sfxCtx.destination);
    } catch {
      sfxCtx = null;
      sfxMaster = null;
      return;
    }
  }
  if (sfxCtx && sfxCtx.state === "suspended") {
    try {
      sfxCtx.resume();
    } catch {}
  }
}

function playBeep({ freq = 660, dur = 0.12, gain = 0.12, type = "sine" }) {
  if (!desiredEnabled || !unlocked) return; // keep autoplay-safe
  if (!sfxCtx || !sfxMaster) return;

  const t0 = sfxCtx.currentTime;
  const osc = sfxCtx.createOscillator();
  const g = sfxCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);

  // Envelope
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.02, dur));

  osc.connect(g);
  g.connect(sfxMaster);

  try {
    osc.start(t0);
    osc.stop(t0 + Math.max(0.03, dur) + 0.02);
  } catch {}
}

/**
 * Play milestone stingers. kinds: 'faith' | 'starlight' | 'constellation' | 'sky'
 */
export function playStinger(kind) {
  tryResumeSfx();
  switch (kind) {
    case "faith":
      playBeep({ freq: 523.25, dur: 0.14, gain: 0.13, type: "triangle" });
      playBeep({ freq: 783.99, dur: 0.10, gain: 0.09, type: "sine" });
      break;
    case "starlight":
      playBeep({ freq: 392.0, dur: 0.12, gain: 0.10, type: "sine" });
      playBeep({ freq: 784.0, dur: 0.16, gain: 0.12, type: "sine" });
      break;
    case "constellation":
      playBeep({ freq: 659.25, dur: 0.08, gain: 0.11, type: "sine" });
      playBeep({ freq: 987.77, dur: 0.10, gain: 0.09, type: "triangle" });
      break;
    case "sky":
      playBeep({ freq: 246.94, dur: 0.16, gain: 0.12, type: "sawtooth" });
      playBeep({ freq: 369.99, dur: 0.18, gain: 0.10, type: "sine" });
      break;
    default:
      playBeep({ freq: 660, dur: 0.12, gain: 0.10, type: "sine" });
      break;
  }
}


// Back-compat shim for earlier builds (Step 3 constellation tree).
// Some UI code imports playSfx("reveal"|"unlock").
// Keep this stable so future refactors don't break runtime.
export function playSfx(kind = "generic") {
  if (!desiredEnabled || desiredVolume <= 0) return;

  // Keep SFX autoplay-safe: only play after unlock.
  if (!unlocked) return;

  switch (kind) {
    case "reveal":
      // soft ping
      playBeep({ freq: 784, dur: 0.06, gain: 0.08, type: "sine" });
      playBeep({ freq: 1046.5, dur: 0.07, gain: 0.06, type: "triangle" });
      break;
    case "unlock":
      // stronger stinger
      playStinger("constellation");
      break;
    default:
      playBeep({ freq: 660, dur: 0.08, gain: 0.08, type: "sine" });
      break;
  }
}
