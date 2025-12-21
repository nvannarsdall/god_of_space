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

// Embedded Pixel Sun Asset
const SUN_BASE64 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAHhJREFUWEft1sEJwCAMBMCw/3b05C6h4CCE+F0C9yM5b4e57ozZ+R7j4wF4A4AA8AYAAeANAALAGwAEgDcACABvABAA3gAgALwBQAB4A4AA8AYAAeANwAF8P+oF15U75QAAAABJRU5ErkJggg==";

/* --- INTRO CUTSCENE --- */
function IntroCutscene({ onDone }) {
  const [phase, setPhase] = useState(0);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  const assets = useRef({ house: null, houseDark: null, sun: null });
  const anim = useRef({ start: 0, particles: [] });

  useEffect(() => {
    // Robust Asset Loading
    const load = (src) =>
      new Promise((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
      });

    Promise.all([
      load("/assets/pixel/spr_house.png"),
      load("/assets/pixel/spr_house_dark.png"),
      load(SUN_BASE64),
    ]).then(([h, hd, s]) => {
      assets.current.house = h;
      assets.current.houseDark = hd;
      assets.current.sun = s;
    });
  }, []);

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
      const A = assets.current;

      // Timeline Logic
      let skyCol = "#4fa4b8";
      let groundCol = "#3e8948";
      let ashAmt = 0;
      let shake = 0;
      let sunY = H * 0.2;
      let useDark = false;

      if (t > 4 && t < 9) {
        const p = (t - 4) / 5;
        setPhase(1);
        skyCol = p < 0.5 ? "#d95763" : "#595652";
        groundCol = "#595652";
        ashAmt = p * 20;
        shake = p * 4;
        sunY += p * 50;
        useDark = p > 0.6;
      } else if (t >= 9) {
        setPhase(2);
        skyCol = "#1a1c2c";
        groundCol = "#292b3d";
        ashAmt = 10;
        shake = 0;
        useDark = true;
      }

      // 1. Draw Sky
      ctx.fillStyle = skyCol;
      ctx.fillRect(0, 0, W, H);

      // Camera Shake
      ctx.save();
      if (shake > 0) {
        ctx.translate(
          (Math.random() - 0.5) * shake,
          (Math.random() - 0.5) * shake
        );
      }

      // 2. Draw Sun
      if (A.sun && t < 8.5) {
        ctx.imageSmoothingEnabled = false;
        // Glow
        ctx.fillStyle = "rgba(255, 220, 150, 0.4)";
        ctx.fillRect(W / 2 - 20, sunY - 20, 40, 40);
        // Sprite
        ctx.drawImage(
          A.sun,
          Math.round(W / 2 - 32),
          Math.round(sunY - 32),
          64,
          64
        );
      }

      // 3. Draw Ground (Overscan to hide shake borders)
      const groundY = H * 0.75;
      pixelRect(-100, groundY, W + 200, H, groundCol); // Huge rect covers everything

      if (t > 9) pixelRect(-100, groundY, W + 200, 4, "#f2f0e5");

      // 4. Draw Houses
      // Anchor them slightly INTO the ground (Y+6) so no gap appears
      const houseY = groundY + 6;
      const spacing = 90; // Balanced spacing
      const numHouses = 5;
      const startX = (W - (numHouses - 1) * spacing) / 2;

      for (let i = 0; i < numHouses; i++) {
        const hx = startX + i * spacing;
        const sprite = useDark ? A.houseDark : A.house;

        if (sprite) {
          // Scale = 2 (Clean Hi-Bit Look)
          const scale = 2;
          const sw = sprite.width * scale;
          const sh = sprite.height * scale;

          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            sprite,
            Math.round(hx - sw / 2),
            Math.round(houseY - sh),
            sw,
            sh
          );
        } else {
          // Fallback
          pixelRect(hx - 20, houseY - 30, 40, 30, "#000");
        }
      }

      ctx.restore(); // End Shake

      // 5. Draw Ash
      if (ashAmt > 0) {
        if (Math.random() < ashAmt * 0.8) {
          anim.current.particles.push({
            x: Math.random() * W,
            y: -5,
            vx: (Math.random() - 0.5) * 3,
            vy: 1 + Math.random() * 2,
          });
        }
        ctx.fillStyle = "#ddd";
        for (let i = anim.current.particles.length - 1; i >= 0; i--) {
          let p = anim.current.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, 3);
          if (p.y > H) anim.current.particles.splice(i, 1);
        }
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

      if (t > 1 && t < 4) drawText("THE SKY WAS OUR GUIDE", H / 3);
      if (t > 5 && t < 8) drawText("UNTIL THE ASH FELL", H / 3, "#e64539");
      if (t > 9) drawText("NOW WE WAIT IN THE DARK", H / 3);

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
            IGNITE THE SPARK
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
