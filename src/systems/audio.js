// Centralized music authority for the whole app (intro cutscene + gameplay).
//
// Goals (Phase A):
// - Single source of truth for music (no double-audio, no playlist pauses).
// - Autoplay-safe: start muted, unmute on first user gesture.
// - Respect settings (enabled + volume) and persist continuity.

let music = null;
let unlocked = false;

function safePlay(a) {
  try {
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch {}
}

function ensureUnlockHandlers(a) {
  if (typeof window === "undefined") return;
  if (unlocked) return;

  const unlock = () => {
    unlocked = true;
    // Do not force-enable music here; just allow it to be heard if enabled.
    a.muted = false;
    safePlay(a);
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };

  // Use {once:true} where supported to avoid leaks.
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });
}

export function getMusic() {
  if (music) return music;
  if (typeof Audio === "undefined") return null;

  const a = new Audio("/assets/audio/god_of_space_theme.wav");
  a.loop = true;
  a.volume = 0.65;
  a.muted = true;
  a.preload = "auto";

  // Muted autoplay is generally allowed.
  safePlay(a);
  ensureUnlockHandlers(a);

  music = a;
  return music;
}

export function applyMusicSettings({ enabled, volume }) {
  const a = getMusic();
  if (!a) return;

  const vol = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.65;
  a.volume = vol;

  if (!enabled) {
    // Pause to avoid consuming resources; keep currentTime for continuity.
    try {
      a.pause();
    } catch {}
    a.muted = true;
    return;
  }

  // Enabled: keep playing (muted until user gesture unlocks, per browser policy).
  // If already unlocked, unmute; otherwise keep muted until unlock.
  a.muted = !unlocked;
  safePlay(a);
}
