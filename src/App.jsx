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

/* --- INTRO CUTSCENE --- */
function IntroCutscene({ onDone }) {
  const [phase, setPhase] = useState(0);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const GOD_NAME = "Astrael";
  const TIMING = {
    flashStart: 3.0,
    flashEnd: 4.6,
    darkStart: 4.2,
    darkEnd: 8.5,
    vanishStart: 8.5,
    vanishEnd: 14.5,
    ctaStart: 15.5,
  };

  const anim = useRef({
    start: 0,
    stars: [],
    embers: [],
    moon: null,
    seeded: false,
  });

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");

    // High-Res Pixel Canvas
    const W = 640;
    const H = 360;
    c.width = W;
    c.height = H;

    const pixelRect = (x, y, w, h, col) => {
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };

    const loop = (now) => {
      if (!anim.current.start) anim.current.start = now;
      const t = (now - anim.current.start) / 1000;

      const phaseNow = t >= 10 ? 2 : t >= 6 ? 1 : 0;
      if (phaseNow !== phase) {
        setPhase(phaseNow);
      }

      if (!anim.current.seeded) {
        const vanishWindow = TIMING.vanishEnd - TIMING.vanishStart;
        anim.current.seeded = true;
        anim.current.stars = Array.from({ length: 90 }, () => ({
          x: Math.random() * W,
          y: Math.random() * H * 0.7,
          r: 1 + Math.random() * 1.5,
          tw: Math.random() * Math.PI * 2,
          sp: 0.4 + Math.random() * 0.8,
          fadeAt: 6 + Math.random() * 4,
          fadeDur: 0.6 + Math.random() * 0.8,
        }));
        anim.current.moon = {
          x: W * 0.72,
          y: H * 0.22,
          r: 16,
          fadeAt: 7.5,
          fadeDur: 1.4,
        };
      }

      const flashStart = 2.0;
      const flashEnd = 3.2;
      const darkStart = 3.2;
      const darkEnd = 6.0;
      const darkBlend = clamp((t - darkStart) / (darkEnd - darkStart), 0, 1);
      const dayBlend = 1 - darkBlend;
      const emberBlend = clamp((t - 9) / 3, 0, 1);
      const lerp = (a, b, amt) => Math.round(a + (b - a) * amt);

      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      const topR = lerp(84, 8, darkBlend);
      const topG = lerp(164, 10, darkBlend);
      const topB = lerp(232, 24, darkBlend);
      const botR = lerp(168, 4, darkBlend);
      const botG = lerp(206, 6, darkBlend);
      const botB = lerp(248, 18, darkBlend);
      skyGrad.addColorStop(0, `rgb(${topR}, ${topG}, ${topB})`);
      skyGrad.addColorStop(1, `rgb(${botR}, ${botG}, ${botB})`);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      if (t >= flashStart && t <= flashEnd) {
        const flashT = (t - flashStart) / (flashEnd - flashStart);
        const flicker = Math.abs(Math.sin(flashT * Math.PI * 10));
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.5 * flicker;
        ctx.fillStyle = "#f9f3ff";
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      // Stars
      if (darkBlend > 0.1) {
        ctx.save();
        ctx.fillStyle = "#e6f5ff";
        const nightAlpha = clamp((darkBlend - 0.1) / 0.9, 0, 1);
        anim.current.stars.forEach((s) => {
          const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(t * s.sp + s.tw));
          const fadeOut = 1 - clamp((t - s.fadeAt) / s.fadeDur, 0, 1);
          ctx.globalAlpha = twinkle * nightAlpha * fadeOut;
          if (ctx.globalAlpha > 0.02) {
            ctx.fillRect(Math.round(s.x), Math.round(s.y), s.r, s.r);
          }
        });
        ctx.restore();
      }

      if (anim.current.moon && darkBlend > 0.15) {
        const { x, y, r, fadeAt, fadeDur } = anim.current.moon;
        const moonFade = 1 - clamp((t - fadeAt) / fadeDur, 0, 1);
        const moonAlpha = clamp((darkBlend - 0.15) / 0.85, 0, 1) * moonFade;
        if (moonAlpha > 0.02) {
          ctx.save();
          ctx.globalAlpha = moonAlpha;
          ctx.fillStyle = "#f3e6c8";
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Horizon layers
      const groundY = H * 0.72;
      if (dayBlend > 0.05) {
        const haze = ctx.createLinearGradient(0, groundY - 40, 0, groundY + 20);
        haze.addColorStop(0, `rgba(255, 215, 175, ${0.2 * dayBlend})`);
        haze.addColorStop(1, "rgba(255, 215, 175, 0)");
        ctx.save();
        ctx.fillStyle = haze;
        ctx.fillRect(0, groundY - 50, W, 60);
        ctx.restore();
      }
      ctx.fillStyle = "#121423";
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(W * 0.2, groundY - 30);
      ctx.lineTo(W * 0.4, groundY - 12);
      ctx.lineTo(W * 0.6, groundY - 34);
      ctx.lineTo(W * 0.8, groundY - 18);
      ctx.lineTo(W, groundY - 26);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#0b0d18";
      pixelRect(0, groundY, W, H - groundY, "#0b0d18");
      if (darkBlend > 0.3) {
        ctx.save();
        ctx.globalAlpha = 0.25 * darkBlend;
        ctx.fillStyle = "#05040a";
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      // Embers rising
      if (emberBlend > 0) {
        if (Math.random() < 0.6 + emberBlend * 0.8) {
          anim.current.embers.push({
            x: W / 2 + (Math.random() - 0.5) * 140,
            y: groundY + 10,
            vy: 0.6 + Math.random() * 1.2,
            life: 60 + Math.random() * 40,
          });
        }
        ctx.fillStyle = "#ffb566";
        for (let i = anim.current.embers.length - 1; i >= 0; i--) {
          const e = anim.current.embers[i];
          e.y -= e.vy;
          e.life -= 1;
          ctx.globalAlpha = Math.max(0, e.life / 100);
          ctx.fillRect(Math.round(e.x), Math.round(e.y), 2, 2);
          if (e.life <= 0 || e.y < 0) anim.current.embers.splice(i, 1);
        }
        ctx.globalAlpha = 1;
      }

      // 6. Text
      const drawText = (txt, y, col = "#fff") => {
        ctx.fillStyle = col;
        ctx.font = '20px "Press Start 2P", monospace';
        ctx.textAlign = "center";
        ctx.shadowColor = "#000";
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        ctx.fillText(txt, W / 2, y);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      };

      if (t > 0.8 && t < 4)
        drawText("THE SKY HELD ITS BREATH", H / 3);
      if (t > 4.2 && t < 8)
        drawText("A FLASH SHATTERED THE DAY", H / 3, "#f2b97d");
      if (t > 8.2)
        drawText("THEN EVEN STARS FELL QUIET", H / 3, "#f5e1c5");

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "#05040a",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", imageRendering: "pixelated" }}
      />

      {phase === 2 && (
        <div
          style={{
            position: "absolute",
            bottom: "20%",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            animation: "fadeIn 2s ease",
          }}
        >
          <button
            className="btn btnPrimary"
            style={{ fontSize: "16px", padding: "24px" }}
            onClick={onDone}
          >
            ENTER THE DUSK
          </button>
        </div>
      )}
      <style>{`@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }`}</style>
    </div>
  );
}

/* --- 2. MAIN APP --- */
export default function App() {
  const [showIntro, setShowIntro] = useState(() => {
    return localStorage.getItem("gos_intro_seen") !== "1";
  });

  const [state, setState] = useState(() => {
    const loaded = loadState();
    const merged = loaded ? deepMerge(baseState(), loaded) : baseState();
    return migrateState(merged);
  });

  const computed = useMemo(() => compute(state), [state]);
  const [toast, setToast] = useState(null);

  // Audio & Refs
  const audioRef = useRef(null);
  const urlsRef = useRef([]);
  const [playlist, setPlaylist] = useState([]);
  const [track, setTrack] = useState(0);

  const worldRef = useRef(null);
  const seekerBtnRef = useRef(null);
  const statusRef = useRef(null);
  const upgradesRef = useRef(null);
  const convertBtnRef = useRef(null);
  const skyTabRef = useRef(null);

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
  const leftHudPE = "auto";
  const rightPanelPE = "auto";
  const veilPct = Math.round(computed.veil * 100);

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 1400);
  };

  useEffect(() => {
    const root = document.documentElement;
    const base = String(process.env.PUBLIC_URL || "").replace(/\/$/, "");
    const setVar = (name, relPath) =>
      root.style.setProperty(name, `url("${base}${relPath}")`);
    setVar("--px-panel-tile", "/assets/pixel/panel_tile.png");
    setVar("--px-btn-primary", "/assets/pixel/btn_primary.png");
    setVar("--px-btn-secondary", "/assets/pixel/btn_secondary.png");
    setVar("--px-btn-danger", "/assets/pixel/btn_danger.png");
  }, []);

  useEffect(() => {
    if (!state.settings.autosave) return;
    const id = setInterval(() => saveState(state), 5000);
    return () => clearInterval(id);
  }, [state]);

  useEffect(() => {
    const step = state.settings.reducedMotion ? 1250 : 1000;
    const id = setInterval(() => {
      setState((s0) => {
        const s = migrateState(s0);
        const c = compute(s);
        return migrateState({
          ...s,
          t: s.t + 1,
          followers: Math.min(c.cap, s.followers + c.followerRate),
          devotion: s.devotion + c.devotionRate,
          whispers: s.whispers + (c.omenRate || 0),
          stardust: Math.max(0, s.stardust - 0.015),
        });
      });
    }, step);
    return () => clearInterval(id);
  }, [state.settings.reducedMotion]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = clamp(state.settings.musicVolume ?? 0.65, 0, 1);
    el.muted = !state.settings.musicEnabled;
  }, [state.settings.musicEnabled, state.settings.musicVolume]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playlist.length <= 0) {
      el.pause();
      el.removeAttribute("src");
      try {
        el.load();
      } catch {}
      return;
    }
    const idx = clamp(track, 0, playlist.length - 1);
    if (el.src !== playlist[idx].url) {
      el.src = playlist[idx].url;
      try {
        el.load();
      } catch {}
    }
    if (state.settings.musicEnabled) {
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  }, [playlist, track, state.settings.musicEnabled]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => {
      if (!playlist.length) return;
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
      return migrateState({
        ...s,
        whispers: s.whispers - seekerCost,
        followers: Math.max(1, s.followers),
        unlocked: { ...s.unlocked, awakened: true },
      });
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
    showToast("Reverence condenses into Authority.");
  };

  const buy = (u, which) => {
    setState((s0) => {
      const s = migrateState(s0);
      const tut = Boolean(s.ui?.tutorialActive && s.ui?.screen === "tutorial");
      const step = s.ui?.tutorialStep || 0;
      if (tut && which === "village") {
        if (step < 2) return s;
        if (step === 2 && u.id !== "huts") return s;
        if (step === 3 && !["huts", "temples"].includes(u.id)) return s;
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
        return migrateState({
          ...s,
          devotion: s.devotion - cost,
          village: { ...s.village, [u.id]: lvl + 1 },
        });
      }
      if (s.power < cost) return s;
      return migrateState({
        ...s,
        power: s.power - cost,
        sky: { ...s.sky, [u.id]: lvl + 1 },
      });
    });
  };

  const setTab = (t) => {
    setState((s) => ({ ...s, ui: { ...s.ui, tab: t } }));
  };

  useEffect(() => {
    if (state.ui.tab === "sky" && !state.unlocked.sky) {
      setTab("village");
    }
  }, [state.ui.tab, state.unlocked.sky]);

  const doSave = () => {
    saveState(state);
    showToast("Saved.");
  };

  const doReset = () => {
    try {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem("gos_intro_seen");
    } catch {}
    window.location.reload();
  };

  const replayIntro = () => {
    localStorage.removeItem("gos_intro_seen");
    window.location.reload();
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
    } catch {}
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
    (state.devotion || 0) > 0;
  const portentRemaining = Math.max(
    0,
    (state.buffs?.portentUntil || 0) - state.t
  );
  const portentActive = Boolean(computed?.portentActive);
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

  if (showIntro) {
    return (
      <IntroCutscene
        onDone={() => {
          setShowIntro(false);
          localStorage.setItem("gos_intro_seen", "1");
        }}
      />
    );
  }

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

      <div
        className="leftHud"
        style={{
          pointerEvents: inMenu ? "none" : leftHudPE,
          opacity: inMenu ? 0.6 : 1,
        }}
      >
        <div ref={statusRef}>
          <Card
            title="Status"
            right={<Pill>Day {Math.floor(state.t / 60) + 1}</Pill>}
          >
            <div className="grid2">
              <div className="statBox">
                <div className="statLabel">Followers</div>
                <div className="statValue">{fmt(state.followers)}</div>
                <div className="statSub">Cap {fmt(computed.cap)}</div>
              </div>
              <div className="statBox">
                <div className="statLabel">Veil</div>
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
                Earned from ritual clicks on the village.
              </div>
              {!awakened && (
                <>
                  <Progress value={(state.whispers / seekerCost) * 100} />
                  <div className="statSub">Seeker cost: {seekerCost}</div>
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
                  Reverence
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
                  Authority
                </div>
                <div className="statValueSmall">{fmt(state.power)}</div>
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
                >
                  Convert Reverence → Authority
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

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
            >
              Sky
            </button>
            <button
              className={`tab ${tab === "codex" ? "tabActive" : ""} ${
                tutorialOn ? "tabDisabled" : ""
              }`}
              onClick={() => !tutorialOn && setTab("codex")}
            >
              Codex
            </button>
          </div>
          {tab === "village" && (
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
                if (tutStep === 3) return u.id === "huts" || u.id === "temples";
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
                        Cost: <b>{fmt(cost)}</b> Reverence
                      </div>
                      <Button disabled={!can} onClick={() => buy(u, "village")}>
                        Buy
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {tab === "sky" && (
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
                        Cost: <b>{fmt(cost)}</b> Authority
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
          )}
        </Card>
      </div>

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
              <button
                className="btn btnGhost"
                onClick={replayIntro}
                style={{ fontSize: 12 }}
              >
                Replay Intro
              </button>
            </div>
          </div>
        </div>
      )}

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
      {toast && <div className="toast">{toast}</div>}
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
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !playlist.length) return;
    const idx = clamp(track, 0, playlist.length - 1);
    if (el.src !== playlist[idx].url) {
      el.src = playlist[idx].url;
      try {
        el.load();
      } catch {}
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
