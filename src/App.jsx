/* eslint-disable */
import React, { useEffect, useMemo, useRef, useState } from "react";
import WorldCanvas from "./components/WorldCanvas";
import { Button, Card, Pill, Progress } from "./components/ui";
import { compute } from "./game/compute";
import { SKY_UPGRADES, VILLAGE_UPGRADES, upgradeCost } from "./game/upgrades";
import {
  LS_KEY,
  baseState,
  clamp,
  deepMerge,
  fmt,
  loadState,
  migrateState,
  saveState,
} from "./game/state";
import TutorialOverlay from "./tutorial/TutorialOverlay";
import { buildTutorialSteps } from "./tutorial/tutorialData";
function IntroCutscene({ onDone }) {
  const canvasRef = React.useRef(null);
  const rafRef = React.useRef(null);
  const startTsRef = React.useRef(null);
  const starsRef = React.useRef([]);
  const [phase, setPhase] = React.useState("idle"); // idle -> playing -> done
  const [muted, setMuted] = React.useState(false);

  const audioRef = React.useRef({
    ctx: null,
    master: null,
  });

  function ensureAudio() {
    if (audioRef.current.ctx) return audioRef.current;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
    audioRef.current.ctx = ctx;
    audioRef.current.master = master;
    return audioRef.current;
  }

  function playWhoosh() {
    if (muted) return;
    const { ctx, master } = ensureAudio();
    const now = ctx.currentTime;

    // noise buffer
    const bufferSize = Math.floor(ctx.sampleRate * 0.35);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++)
      data[i] = (Math.random() * 2 - 1) * 0.8;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(2200, now + 0.25);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.9, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    noise.start(now);
    noise.stop(now + 0.36);
  }

  function playChime() {
    if (muted) return;
    const { ctx, master } = ensureAudio();
    const now = ctx.currentTime;

    const freqs = [440, 660, 880];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now + idx * 0.02);
      g.gain.exponentialRampToValueAtTime(0.35, now + 0.03 + idx * 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45 + idx * 0.02);

      osc.connect(g);
      g.connect(master);

      osc.start(now + idx * 0.02);
      osc.stop(now + 0.6);
    });
  }

  function initStars(w, h) {
    const n = 220;
    const stars = [];
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random(), // depth
        s: 0.4 + Math.random() * 1.6, // size
        v: 0.15 + Math.random() * 0.85, // speed factor
      });
    }
    starsRef.current = stars;
  }

  React.useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const resize = () => {
      const rect = c.getBoundingClientRect();
      c.width = Math.floor(rect.width * dpr);
      c.height = Math.floor(rect.height * dpr);
      const ctx = c.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      initStars(c.width, c.height);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  React.useEffect(() => {
    if (phase !== "playing") return;

    const c = canvasRef.current;
    const ctx = c.getContext("2d");

    const tick = (ts) => {
      if (!startTsRef.current) startTsRef.current = ts;
      const t = (ts - startTsRef.current) / 1000;

      const w = c.width,
        h = c.height;

      // background
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, w, h);

      // stars
      const stars = starsRef.current;
      for (let i = 0; i < stars.length; i++) {
        const st = stars[i];
        st.y += (0.35 + st.v) * (2.0 - st.z) * (w * 0.00045);

        if (st.y > h + 10) {
          st.y = -10;
          st.x = Math.random() * w;
          st.z = Math.random();
          st.s = 0.4 + Math.random() * 1.6;
          st.v = 0.15 + Math.random() * 0.85;
        }

        const alpha = 0.25 + (1 - st.z) * 0.75;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "white";
        ctx.fillRect(st.x, st.y, st.s * (1.2 - st.z), st.s * (1.2 - st.z));
      }
      ctx.globalAlpha = 1;

      // title fades
      const fadeIn = Math.min(1, Math.max(0, (t - 0.6) / 1.2));
      const hold = t < 4.2 ? 1 : Math.max(0, 1 - (t - 4.2) / 0.8);

      const a = fadeIn * hold;

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.globalAlpha = a;
      ctx.fillStyle = "white";
      ctx.font = `${Math.floor(
        w * 0.06
      )}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      ctx.fillText("GOD OF SPACE", w / 2, h * 0.45);

      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = `${Math.floor(
        w * 0.022
      )}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      ctx.fillText("From starlight… to reverence.", w / 2, h * 0.53);

      ctx.restore();

      // auto-end
      if (t >= 5.2) {
        setPhase("done");
        onDone?.();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [phase, onDone]);

  React.useEffect(() => {
    if (phase === "done") {
      // stop audio context politely (optional)
      return;
    }
  }, [phase]);

  const begin = async () => {
    setPhase("playing");
    // unlock audio on gesture
    const { ctx } = ensureAudio();
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {}
    }
    playWhoosh();
    setTimeout(() => playChime(), 650);
  };

  const skip = () => {
    setPhase("done");
    onDone?.();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "black",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />

      <div
        style={{
          position: "absolute",
          left: 16,
          top: 16,
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <button onClick={() => setMuted((m) => !m)} style={btnStyle}>
          {muted ? "Unmute" : "Mute"}
        </button>
      </div>

      <div
        style={{
          position: "absolute",
          right: 16,
          top: 16,
          display: "flex",
          gap: 8,
        }}
      >
        <button onClick={skip} style={btnStyle}>
          Skip
        </button>
      </div>

      {phase === "idle" && (
        <div
          style={{
            position: "absolute",
            bottom: 42,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <button
            onClick={begin}
            style={{ ...btnStyle, padding: "12px 18px", fontSize: 16 }}
          >
            Begin
          </button>
        </div>
      )}
    </div>
  );
}

const btnStyle = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.22)",
  color: "white",
  borderRadius: 10,
  padding: "8px 12px",
  cursor: "pointer",
  fontFamily:
    "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
};

export default function App() {
  const [showIntro, setShowIntro] = useState(() => {
    return localStorage.getItem("gos_intro_seen") !== "1";
  });

  const finishIntro = () => {
    try {
      localStorage.setItem("gos_intro_seen", "1");
    } catch {
      // ignore
    }
    setShowIntro(false);
  };
  const [state, setState] = useState(() => {
    const loaded = loadState();
    const merged = loaded ? deepMerge(baseState(), loaded) : baseState();
    return migrateState(merged);
  });

  const computed = useMemo(() => compute(state), [state]);

  const [toast, setToast] = useState(null);

  // audio
  const audioRef = useRef(null);
  const urlsRef = useRef([]);
  const [playlist, setPlaylist] = useState([]);
  const [track, setTrack] = useState(0);

  // tutorial/menu spotlight refs
  const worldRef = useRef(null);
  const seekerBtnRef = useRef(null);
  const statusRef = useRef(null);
  const upgradesRef = useRef(null);
  const convertBtnRef = useRef(null);
  const skyTabRef = useRef(null);

  // helper for tutorial rects (stable + reusable)
  const getRectFromRef = (ref) => {
    const el = ref?.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  };

  const tab = state.ui.tab;
  const awakened = state.unlocked.awakened;

  const tutorialOn = Boolean(
    state.ui?.tutorialActive && state.ui?.screen === "tutorial"
  );
  const tutStep = state.ui?.tutorialStep || 0;
  const seekerCost = 20;

  const tutorialSteps = useMemo(() => {
    if (!tutorialOn) return [];
    return buildTutorialSteps({
      state,
      seekerCost,
      getRect: getRectFromRef,
      refs: {
        world: worldRef,
        status: statusRef,
        seekerButton: seekerBtnRef,
        upgrades: upgradesRef,
        convertButton: convertBtnRef,
        skyTab: skyTabRef,
      },
    });
  }, [state, tutorialOn, seekerCost]);

  const tutorialStepData = tutorialOn
    ? tutorialSteps[clamp(tutStep, 0, tutorialSteps.length - 1)]
    : null;

  const tutorialTotal = tutorialSteps.length || 6;
  const tutorialIndex = tutorialStepData
    ? clamp(tutStep, 0, tutorialTotal - 1)
    : 0;
  const tutorialAllows = tutorialStepData?.allow || {};

  const isVillageListStep = tutorialOn
    ? Boolean(tutorialAllows.villageUpgrades)
    : true;
  const isConvertStep = tutorialOn ? Boolean(tutorialAllows.convert) : true;
  const isSkyTabStep = tutorialOn ? Boolean(tutorialAllows.skyTab) : true;
  const isSkyUpgradeStep = tutorialOn
    ? Boolean(tutorialAllows.skyUpgrades)
    : true;
  const isSeekerStep = tutorialOn ? Boolean(tutorialAllows.seeker) : true;

  const inMenu = state.ui?.screen === "menu";

  // The tutorial should guide, not block the player from using the HUD.
  const leftHudPE = "auto";
  const rightPanelPE = "auto";

  const veilPct = Math.round(computed.veil * 100);

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 1400);
  };

  // bind pixel UI textures from /public without breaking the CSS build
  useEffect(() => {
    const root = document.documentElement;
    const base = String(process.env.PUBLIC_URL || "").replace(/\/$/, "");
    const setVar = (name, relPath) => {
      root.style.setProperty(name, `url("${base}${relPath}")`);
    };
    setVar("--px-panel-tile", "/assets/pixel/panel_tile.png");
    setVar("--px-btn-primary", "/assets/pixel/btn_primary.png");
    setVar("--px-btn-secondary", "/assets/pixel/btn_secondary.png");
    setVar("--px-btn-danger", "/assets/pixel/btn_danger.png");
  }, []);

  // autosave
  useEffect(() => {
    if (showIntro) return;
    if (!state.settings.autosave) return;
    const id = setInterval(() => saveState(state), 5000);
    return () => clearInterval(id);
  }, [state, showIntro]);

  // tick loop
  useEffect(() => {
    if (showIntro) return;
    const step = state.settings.reducedMotion ? 1250 : 1000;
    const id = setInterval(() => {
      setState((s0) => {
        const s = migrateState(s0);
        const c = compute(s);

        const nextDevotees = Math.min(c.cap, s.followers + c.followerRate);
        const nextDevotion = s.devotion + c.devotionRate;
        const nextOmens = s.whispers + (c.omenRate || 0);
        const nextStardust = Math.max(0, s.stardust - 0.015);

        return migrateState({
          ...s,
          t: s.t + 1,
          followers: nextDevotees,
          devotion: nextDevotion,
          whispers: nextOmens,
          stardust: nextStardust,
        });
      });
    }, step);
    return () => clearInterval(id);
  }, [state.settings.reducedMotion, showIntro]);

  // audio settings apply
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = clamp(state.settings.musicVolume ?? 0.65, 0, 1);
    el.muted = !state.settings.musicEnabled;
  }, [state.settings.musicEnabled, state.settings.musicVolume]);

  // swap track
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playlist.length <= 0) {
      el.pause();
      el.removeAttribute("src");
      try {
        el.load();
      } catch {
        // ignore
      }
      return;
    }
    const idx = clamp(track, 0, playlist.length - 1);
    const url = playlist[idx]?.url;
    if (url && el.src !== url) {
      el.src = url;
      try {
        el.load();
      } catch {
        // ignore
      }
    }
    if (state.settings.musicEnabled) {
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  }, [playlist, track, state.settings.musicEnabled]);

  // loop playlist
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => {
      if (playlist.length <= 0) return;
      setTrack((i) => (i + 1) % playlist.length);
    };
    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  }, [playlist.length]);

  const clickVillage = () => {
    setState((s0) => {
      const s = migrateState(s0);
      if (tutorialOn && !tutorialAllows.world) return s;

      const c = compute(s);

      // Village clicks are now always "ritual" clicks: they generate Omens.
      // Faith is earned primarily from followers (passive), not from clicks.
      const gain = Math.max(0.25, c.omenClickGain || 1);
      return { ...s, whispers: s.whispers + gain };
    });
  };

  const clickSky = () => {
    setState((s0) => {
      const s = migrateState(s0);
      if (tutorialOn && !tutorialAllows.world) return s;

      const c = compute(s);

      const base = 0.12 * c.telescopeBonus;
      let stardust = s.stardust + base;
      let power = s.power;

      // crystallize some immediately if sky unlocked
      if (s.unlocked.sky) {
        const immediate = Math.min(stardust, 0.25);
        stardust -= immediate;
        power += immediate * 0.75;
      }

      return migrateState({ ...s, stardust, power });
    });
  };

  const canCallSeeker = !awakened && state.whispers >= seekerCost;

  const callSeeker = () => {
    setState((s0) => {
      const s = migrateState(s0);
      if (tutorialOn && s.ui?.tutorialStep !== 1) return s;
      if (s.unlocked.awakened) return s;
      if (s.whispers < seekerCost) return s;

      const next = migrateState({
        ...s,
        whispers: s.whispers - seekerCost,
        followers: Math.max(1, s.followers),
        unlocked: { ...s.unlocked, awakened: true },
      });

      return next;
    });
    showToast("A Seeker enters the dusk.");
  };

  const PORTENT_COST = 30;
  const invokePortent = () => {
    setState((s0) => {
      const s = migrateState(s0);
      if (!s.unlocked.awakened) return s;
      if (s.whispers < PORTENT_COST) return s;
      const shrines = s.village?.shrines || 0;
      const duration = 45 + shrines * 5;
      const until = (s.t || 0) + duration;
      return migrateState({
        ...s,
        whispers: s.whispers - PORTENT_COST,
        buffs: { ...(s.buffs || {}), portentUntil: until },
      });
    });
    showToast("A Portent ignites the dusk.");
  };

  const convert = () => {
    setState((s0) => {
      const s = migrateState(s0);

      if (tutorialOn && s.ui?.tutorialStep !== 4) return s;

      const c = compute(s);
      if (!s.unlocked.convert) return s;
      if (s.devotion < 10) return s;

      const spend = Math.min(s.devotion, Math.max(10, s.devotion * 0.12));
      const gain = spend * c.convertEff;
      return migrateState({
        ...s,
        devotion: s.devotion - spend,
        power: s.power + gain,
      });
    });
    showToast("Faith condenses into Dominion.");
  };

  const buy = (u, which) => {
    setState((s0) => {
      const s = migrateState(s0);

      // tutorial gating (keeps the early game simple)
      const tut = Boolean(s.ui?.tutorialActive && s.ui?.screen === "tutorial");
      const step = s.ui?.tutorialStep || 0;
      if (tut && which === "village") {
        if (step < 2) return s; // no upgrades until after Seeker
        if (step === 2 && u.id !== "huts") return s; // only Huts
        if (step === 3 && !["huts", "temples"].includes(u.id)) return s; // Huts + Temples
      }
      if (tut && which === "sky") {
        if (step < 5) return s;
        if (step === 5 && u.id !== "starsong") return s;
      }

      const lvl = which === "village" ? s.village[u.id] : s.sky[u.id];
      const cost = upgradeCost(u.baseCost, u.growth, lvl);

      if (u.currency === "devotion") {
        if (!s.unlocked.awakened) return s;
        if (s.devotion < cost) return s;
        const next = {
          ...s,
          devotion: s.devotion - cost,
          village: { ...s.village, [u.id]: lvl + 1 },
        };
        return migrateState(next);
      }
      if (s.power < cost) return s;
      const next = {
        ...s,
        power: s.power - cost,
        sky: { ...s.sky, [u.id]: lvl + 1 },
      };
      return migrateState(next);
    });
  };

  const setTab = (t) => {
    setState((s) => ({ ...s, ui: { ...s.ui, tab: t } }));
  };

  // ensure tab availability
  useEffect(() => {
    if (state.ui.tab === "sky" && !state.unlocked.sky) {
      setTab("village");
    }
  }, [state.ui.tab, state.unlocked.sky]);

  // manual save / reset
  const doSave = () => {
    saveState(state);
    showToast("Saved.");
  };

  const doReset = () => {
    const keep = state.settings;
    const next = baseState();
    next.settings = { ...keep };
    setState(next);
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      // ignore
    }
    showToast("Reset complete.");
  };

  const advanceTutorial = () => {
    setState((s0) => {
      const s = migrateState(s0);
      const step = s.ui?.tutorialStep || 0;
      const nextStep = step + 1;
      if (nextStep >= tutorialTotal) {
        return migrateState({
          ...s,
          ui: {
            ...s.ui,
            screen: "game",
            tutorialActive: false,
            tutorialStep: step,
          },
        });
      }
      return migrateState({ ...s, ui: { ...s.ui, tutorialStep: nextStep } });
    });
  };

  const skipTutorial = () => {
    setState((s) =>
      migrateState({
        ...s,
        ui: {
          ...s.ui,
          screen: "game",
          tutorialActive: false,
          tutorialHidden: true,
        },
      })
    );
  };

  // when tutorial is completed or turned off, make sure we're in-game
  useEffect(() => {
    if (state.ui?.screen === "tutorial" && !state.ui?.tutorialActive) {
      setState((s) => ({ ...s, ui: { ...s.ui, screen: "game" } }));
    }
  }, [state.ui?.screen, state.ui?.tutorialActive]);

  const startTutorial = () => {
    const keep = state.settings;
    const next = baseState();
    next.settings = { ...keep };
    next.ui = {
      ...next.ui,
      screen: "tutorial",
      tutorialActive: true,
      tutorialStep: 0,
      tutorialHidden: true,
      tab: "village",
    };
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      // ignore
    }
    setState(migrateState(next));
    showToast("The dusk begins.");
  };

  const continueGame = () => {
    setState((s) =>
      migrateState({
        ...s,
        ui: {
          ...s.ui,
          screen: "game",
          tutorialActive: false,
          tutorialHidden: true,
        },
      })
    );
  };

  const hasProgress =
    (state.whispers || 0) > 0 ||
    (state.followers || 0) > 0 ||
    (state.devotion || 0) > 0 ||
    (state.power || 0) > 0 ||
    (state.village?.huts || 0) > 0 ||
    (state.village?.shrines || 0) > 0 ||
    (state.sky?.starsong || 0) > 0;

  const portentRemaining = Math.max(
    0,
    (state.buffs?.portentUntil || 0) - state.t
  );
  const portentActive = Boolean(computed?.portentActive);

  // Fix tutorial “panel obstructs screen”:
  // If the tutorial step anchors to the full-screen world, force the anchor to Status instead.
  const tutorialRect =
    tutorialOn && tutorialStepData
      ? tutorialStepData.id === "omens"
        ? getRectFromRef(statusRef) || tutorialStepData.target?.()
        : tutorialStepData.target?.()
      : null;

  const tutorialRects =
    tutorialOn && tutorialStepData?.targets
      ? tutorialStepData.targets.map((fn) => fn()).filter(Boolean)
      : null;

  return (
    <div className="appRoot">
      <audio ref={audioRef} />
      <div ref={worldRef} style={{ position: "fixed", inset: 0 }}>
        <WorldCanvas
          mode={tab}
          state={state}
          computed={computed}
          onClickVillage={clickVillage}
          onClickSky={clickSky}
        />
      </div>

      {/* Top bar */}
      <div
        className="topBar"
        style={{
          pointerEvents: inMenu ? "none" : "auto",
          opacity: inMenu ? 0.6 : 1,
        }}
      >
        <div className="topBarInner">
          <div className="brand">
            <div className="brandMark">✦</div>
            <div className="brandText">
              <div className="brandTitle">God of Space</div>
              <div className="brandSub">a dusk-lit incremental world</div>
            </div>
          </div>

          <div className="topActions">
            <Button variant="secondary" onClick={doSave} title="Manual save">
              Save
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                setState((s) => ({
                  ...s,
                  settings: {
                    ...s.settings,
                    reducedMotion: !s.settings.reducedMotion,
                  },
                }))
              }
              title="Reduce motion"
            >
              {state.settings.reducedMotion ? "Motion: Low" : "Motion: Full"}
            </Button>
            <Button variant="danger" onClick={doReset} title="Reset progress">
              Reset
            </Button>
          </div>
        </div>
      </div>

      {/* Left HUD */}
      <div
        className="leftHud"
        style={{
          pointerEvents: inMenu ? "none" : leftHudPE,
          opacity: inMenu ? 0.6 : 1,
        }}
      >
        {/* IMPORTANT: ref goes on a real DOM element, not the Card component */}
        <div ref={statusRef}>
          <Card
            title="Status"
            right={<Pill>Day {Math.floor(state.t / 60) + 1}</Pill>}
          >
            <div className="grid2">
              <div className="statBox">
                <div className="statLabel">Devotees</div>
                <div className="statValue">{fmt(state.followers)}</div>
                <div className="statSub">Cap {fmt(computed.cap)}</div>
              </div>
              <div className="statBox">
                <div className="statLabel">Shroud</div>
                <div className="statValue">{veilPct}%</div>
                <div className="statSub">Lower is better</div>
              </div>
            </div>

            <div className="statBox">
              <div className="rowBetween">
                <div className="statLabel">
                  <img
                    className="ico"
                    src="/assets/pixel/icon_omens.png"
                    alt=""
                  />{" "}
                  Omens
                </div>
                <div className="statValueSmall">{fmt(state.whispers)}</div>
              </div>
              <div className="statSub">
                Earned from ritual clicks on the village (always) and Shrines
                (passive). Used to call a Seeker and ignite Portents.
              </div>

              {!awakened && (
                <>
                  <Progress value={(state.whispers / seekerCost) * 100} />

                  <div className="statSub">
                    Seeker cost: {seekerCost} (
                    {Math.max(0, seekerCost - state.whispers)} more)
                  </div>

                  <div
                    ref={seekerBtnRef}
                    className={
                      tutorialStepData?.id === "seeker" ? "tutTarget" : ""
                    }
                    style={{ marginTop: 8 }}
                  >
                    <Button
                      onClick={callSeeker}
                      disabled={!isSeekerStep || !canCallSeeker}
                    >
                      Call a Seeker ({seekerCost})
                    </Button>
                  </div>
                </>
              )}

              {awakened && (
                <div style={{ marginTop: 8 }}>
                  <div
                    className="rowBetween"
                    style={{ gap: 10, flexWrap: "wrap" }}
                  >
                    <Button
                      variant="secondary"
                      onClick={invokePortent}
                      disabled={state.whispers < PORTENT_COST || portentActive}
                      title={
                        portentActive
                          ? "Portent is already active"
                          : state.whispers < PORTENT_COST
                          ? `Need ${
                              PORTENT_COST - Math.floor(state.whispers)
                            } more Omens`
                          : "Boost growth + reverence for a short time"
                      }
                    >
                      Ignite Portent ({PORTENT_COST})
                    </Button>
                    {portentActive && (
                      <Pill>Portent: {Math.ceil(portentRemaining)}s</Pill>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="statBox">
              <div className="rowBetween">
                <div className="statLabel">
                  <img
                    className="ico"
                    src="/assets/pixel/icon_reverence.png"
                    alt=""
                  />{" "}
                  Faith
                </div>
                <div className="statValueSmall">{fmt(state.devotion)}</div>
              </div>
              <div className="statSub">
                Rate: {fmt(computed.devotionRate)}/s{" "}
                {awakened ? "" : "(locked)"}
              </div>
            </div>

            <div className="statBox">
              <div className="rowBetween">
                <div className="statLabel">
                  <img
                    className="ico"
                    src="/assets/pixel/icon_authority.png"
                    alt=""
                  />{" "}
                  Dominion
                </div>
                <div className="statValueSmall">{fmt(state.power)}</div>
              </div>
              <div className="statSub">
                Earned by conversion (and sky clicks later).
              </div>
              <div
                ref={convertBtnRef}
                className={
                  tutorialStepData?.id === "convert" ? "tutTarget" : ""
                }
                style={{ marginTop: 8 }}
              >
                <Button
                  variant="secondary"
                  onClick={convert}
                  disabled={
                    !isConvertStep ||
                    !state.unlocked.convert ||
                    state.devotion < 10
                  }
                  title={
                    !isConvertStep
                      ? "Tutorial: conversion comes later"
                      : state.unlocked.convert
                      ? ""
                      : "Unlock by buying 1 Temple"
                  }
                >
                  Convert Faith → Dominion
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Music */}
        <div style={{ marginTop: 12 }}>
          <Card
            title="Soundtrack"
            right={
              <Button
                variant="secondary"
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    settings: {
                      ...s.settings,
                      musicEnabled: !s.settings.musicEnabled,
                    },
                  }))
                }
              >
                {state.settings.musicEnabled ? "On" : "Off"}
              </Button>
            }
          >
            <input
              className="fileInput"
              type="file"
              multiple
              accept="audio/*"
              onChange={(e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;

                // revoke old
                for (const u of urlsRef.current) {
                  try {
                    URL.revokeObjectURL(u);
                  } catch {
                    // ignore
                  }
                }
                urlsRef.current = [];

                const list = Array.from(files)
                  .filter(
                    (f) =>
                      f.type?.startsWith?.("audio/") ||
                      f.name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)
                  )
                  .map((f) => {
                    const url = URL.createObjectURL(f);
                    urlsRef.current.push(url);
                    return { name: f.name, url };
                  });

                setPlaylist(list);
                setTrack(0);
                setState((s) => ({
                  ...s,
                  settings: { ...s.settings, musicEnabled: true },
                }));

                const el = audioRef.current;
                if (el && list[0]) {
                  el.src = list[0].url;
                  const p = el.play();
                  if (p && typeof p.catch === "function") p.catch(() => {});
                }
              }}
            />

            <div className="smallText">
              {playlist.length
                ? `Now: ${playlist[clamp(track, 0, playlist.length - 1)]?.name}`
                : "Upload audio files to loop"}
            </div>

            <div className="rowBetween" style={{ gap: 8, marginTop: 8 }}>
              <Button
                variant="secondary"
                disabled={!playlist.length}
                onClick={() =>
                  setTrack((i) =>
                    playlist.length
                      ? (i - 1 + playlist.length) % playlist.length
                      : 0
                  )
                }
              >
                ◀
              </Button>
              <Button
                variant="secondary"
                disabled={!playlist.length}
                onClick={() => {
                  const el = audioRef.current;
                  if (!el) return;
                  const p = el.play();
                  if (p && typeof p.catch === "function") p.catch(() => {});
                }}
              >
                Play
              </Button>
              <Button
                variant="secondary"
                disabled={!playlist.length}
                onClick={() =>
                  setTrack((i) =>
                    playlist.length ? (i + 1) % playlist.length : 0
                  )
                }
              >
                ▶
              </Button>
            </div>

            <div className="rowBetween" style={{ gap: 10, marginTop: 10 }}>
              <div className="smallText" style={{ width: 40 }}>
                Vol
              </div>
              <input
                style={{ width: "100%" }}
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={state.settings.musicVolume}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    settings: {
                      ...s.settings,
                      musicVolume: Number(e.target.value),
                    },
                  }))
                }
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Right Panel */}
      <div
        className="rightPanel"
        style={{
          pointerEvents: inMenu ? "none" : rightPanelPE,
          opacity: inMenu ? 0.6 : 1,
        }}
      >
        <Card
          title="Actions"
          right={
            tutorialOn && tutorialStepData ? (
              <Pill>
                Tutorial {tutorialIndex + 1}/{tutorialTotal}
              </Pill>
            ) : (
              <Pill>Freeplay</Pill>
            )
          }
        >
          <div className="tabs">
            <button
              className={`tab ${tab === "village" ? "tabActive" : ""} ${
                tutorialOn && !isVillageListStep ? "tabDisabled" : ""
              }`}
              onClick={() =>
                !tutorialOn || isVillageListStep ? setTab("village") : null
              }
            >
              Village
            </button>
            <button
              ref={skyTabRef}
              className={`tab ${tab === "sky" ? "tabActive" : ""} ${
                !isSkyTabStep || !state.unlocked.sky ? "tabDisabled" : ""
              } ${tutorialStepData?.id === "sky" ? "tutTarget" : ""}`}
              onClick={() =>
                isSkyTabStep && state.unlocked.sky && setTab("sky")
              }
              title={
                !isSkyTabStep
                  ? "Tutorial: the Sky comes later"
                  : state.unlocked.sky
                  ? ""
                  : "Unlock by gaining Dominion"
              }
            >
              Sky
            </button>
            <button
              className={`tab ${tab === "codex" ? "tabActive" : ""} ${
                tutorialOn ? "tabDisabled" : ""
              }`}
              onClick={() => !tutorialOn && setTab("codex")}
              title={tutorialOn ? "Tutorial: Codex disabled" : "Open Codex"}
            >
              Codex
            </button>
          </div>

          {tab === "village" && (
            <>
              <div className="smallText">
                Click the world for <b>Omens</b>. Faith is earned passively from Devotees.
              </div>

              {!isVillageListStep ? (
                <div className="tinyMuted" style={{ marginTop: 10 }}>
                  Tutorial: awaken first — then we’ll build a Hut.
                </div>
              ) : (
                <div
                  className={`list ${
                    tutorialStepData?.id === "huts" ||
                    tutorialStepData?.id === "temple"
                      ? "tutTarget"
                      : ""
                  }`}
                  ref={upgradesRef}
                >
                  {VILLAGE_UPGRADES.filter((u) => {
                    if (!tutorialOn) return true;
                    if (tutStep === 2) return u.id === "huts";
                    if (tutStep === 3)
                      return u.id === "huts" || u.id === "temples";
                    return true;
                  }).map((u) => {
                    const lvl = state.village[u.id] || 0;
                    const cost = upgradeCost(u.baseCost, u.growth, lvl);
                    const can = awakened && state.devotion >= cost;

                    return (
                      <div key={u.id} className="item">
                        <div className="itemTop">
                          <div className="itemName">{u.name}</div>
                          <Pill>Lvl {lvl}</Pill>
                        </div>

                        <div className="itemDesc">{u.desc}</div>
                        <div className="itemEffect">{u.effect(lvl)}</div>

                        <div className="rowBetween" style={{ marginTop: 10 }}>
                          <div className="smallText">
                            Cost: <b>{fmt(cost)}</b> Faith
                          </div>
                          <Button
                            disabled={!can}
                            onClick={() => buy(u, "village")}
                          >
                            Buy
                          </Button>
                        </div>

                        {!awakened && (
                          <div className="tinyMuted">
                            Locked until you call a Seeker.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {tab === "sky" && (
            <>
              {!isSkyTabStep ? (
                <div className="tinyMuted">
                  Tutorial: convert Faith into Dominion first. Then the Sky
                  will open.
                </div>
              ) : (
                <>
                  <div className="smallText">
                    Click the sky for Stardust. Buy upgrades with Dominion.
                    Lower the Shroud to reveal constellations.
                  </div>
                  <div
                    className={`list ${
                      tutorialStepData?.id === "sky" ? "tutTarget" : ""
                    }`}
                  >
                    {SKY_UPGRADES.filter((u) => {
                      if (!tutorialOn) return true;
                      if (tutStep === 5) return u.id === "starsong";
                      return true;
                    }).map((u) => {
                      const lvl = state.sky[u.id] || 0;
                      const cost = upgradeCost(u.baseCost, u.growth, lvl);
                      const can = state.power >= cost && isSkyUpgradeStep;

                      return (
                        <div key={u.id} className="item">
                          <div className="itemTop">
                            <div className="itemName">{u.name}</div>
                            <Pill>Lvl {lvl}</Pill>
                          </div>
                          <div className="itemDesc">{u.desc}</div>
                          <div className="itemEffect">{u.effect(lvl)}</div>
                          <div className="rowBetween" style={{ marginTop: 10 }}>
                            <div className="smallText">
                              Cost: <b>{fmt(cost)}</b> Dominion
                            </div>
                            <Button
                              disabled={!can}
                              onClick={() => buy(u, "sky")}
                              variant="primary"
                            >
                              Buy
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {tab === "codex" && (
            <div className="codex">
              <div className="codexTitle">Codex</div>
              <p>
                You are the still point in the long night. The village grows not
                because it must — but because you decide it should.
              </p>
              <p>
                The Shroud is not weather. It is history. Peel it back, and the
                constellations become true.
              </p>
              <div className="codexBox">
                <div className="codexBoxTitle">Loop</div>
                <ul>
                  <li>Click world → Omens (until awakened)</li>
                  <li>Omens → Call Seeker</li>
                  <li>Devotees → Faith</li>
                  <li>Faith → Village upgrades</li>
                  <li>Temple → Convert → Dominion</li>
                  <li>Dominion → Sky upgrades → Shroud falls</li>
                </ul>
              </div>
            </div>
          )}

          <div className="tinyMuted" style={{ marginTop: 10 }}>
            Tip: clicks always matter — progression changes what they do.
          </div>
        </Card>
      </div>

      {/* Main Menu */}
      {inMenu && (
        <div className="menuOverlay">
          <div className="menuCard">
            <div className="menuTitle">God of Space</div>
            <div className="menuSub">
              The sky is sealed. The village still whispers your name.
            </div>

            <div className="menuButtons">
              <button className="btn btnPrimary" onClick={startTutorial}>
                Start Tutorial
              </button>

              <button
                className="btn btnSecondary"
                onClick={continueGame}
                disabled={!hasProgress}
              >
                Continue
              </button>

              <button className="btn btnDanger" onClick={doReset}>
                Reset Save
              </button>
            </div>

            <div className="menuHint">
              New? Choose <b>Start Tutorial</b>. It introduces one mechanic at a
              time.
            </div>
          </div>
        </div>
      )}

      {/* Spotlight Tutorial */}
      {tutorialOn && tutorialStepData && (
        <TutorialOverlay
          rect={tutorialRect}
          rects={tutorialRects}
          title={tutorialStepData.title}
          body={tutorialStepData.body}
          step={tutorialIndex + 1}
          total={tutorialTotal}
          showNext={tutorialStepData.done?.()}
          nextLabel={tutorialIndex + 1 >= tutorialTotal ? "Finish" : "Next"}
          onNext={advanceTutorial}
          onSkip={skipTutorial}
        />
      )}

      {/* Intro Cutscene Overlay */}
      {showIntro && <IntroCutscene onDone={finishIntro} />}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}

      {/* Music track switcher effect */}
      <TrackBinder
        playlist={playlist}
        track={track}
        setTrack={setTrack}
        audioRef={audioRef}
        enabled={state.settings.musicEnabled}
        volume={state.settings.musicVolume}
      />
    </div>
  );
}

function TrackBinder({ playlist, track, setTrack, audioRef, enabled, volume }) {
  // keep audio element aligned with track changes
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!playlist.length) return;
    const idx = clamp(track, 0, playlist.length - 1);
    if (el.src !== playlist[idx].url) {
      el.src = playlist[idx].url;
      try {
        el.load();
      } catch {
        // ignore
      }
    }
    el.volume = clamp(volume ?? 0.65, 0, 1);
    el.muted = !enabled;

    if (enabled) {
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  }, [playlist, track, enabled, volume, audioRef]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => {
      if (!playlist.length) return;
      setTrack((i) => (i + 1) % playlist.length);
    };
    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  }, [playlist.length, setTrack, audioRef]);

  return null;
}
