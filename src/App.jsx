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

const codex = "codex";
const TAB_VILLAGE = "village";
const TAB_SKY = "sky";
const TAB_CODEX = codex;
const TAB_OPTIONS = [TAB_VILLAGE, TAB_SKY, TAB_CODEX];

export default function App() {
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
  const upgradesRef = useRef(null);
  const convertBtnRef = useRef(null);
  const skyTabRef = useRef(null);

  const tab = state.ui.tab;
  const safeTab = TAB_OPTIONS.includes(tab) ? tab : TAB_VILLAGE;
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
      getRect: (ref) => {
        const el = ref?.current;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      },
      refs: {
        world: worldRef,
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
  const isConvertStep = tutorialOn
    ? Boolean(tutorialAllows.convert)
    : true;
  const isSkyTabStep = tutorialOn
    ? Boolean(tutorialAllows.skyTab)
    : true;
  const isSkyUpgradeStep = tutorialOn
    ? Boolean(tutorialAllows.skyUpgrades)
    : true;
  const isSeekerStep = tutorialOn ? Boolean(tutorialAllows.seeker) : true;

  const inMenu = state.ui?.screen === "menu";

  const leftHudPE = tutorialOn
    ? isSeekerStep || isConvertStep
      ? "auto"
      : "none"
    : "auto";
  const rightPanelPE = tutorialOn
    ? isVillageListStep || isSkyTabStep || isSkyUpgradeStep
      ? "auto"
      : "none"
    : "auto";

  const veilPct = Math.round(computed.veil * 100);

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 1400);
  };

  // autosave
  useEffect(() => {
    if (!state.settings.autosave) return;
    const id = setInterval(() => saveState(state), 5000);
    return () => clearInterval(id);
  }, [state]);

  // tick loop
  useEffect(() => {
    const step = state.settings.reducedMotion ? 1250 : 1000;
    const id = setInterval(() => {
      setState((s0) => {
        const s = migrateState(s0);
        const c = compute(s);

        const nextFollowers = Math.min(c.cap, s.followers + c.followerRate);
        const nextDevotion = s.devotion + c.devotionRate;
        const nextStardust = Math.max(0, s.stardust - 0.015);

        return migrateState({
          ...s,
          t: s.t + 1,
          followers: nextFollowers,
          devotion: nextDevotion,
          stardust: nextStardust,
        });
      });
    }, step);
    return () => clearInterval(id);
  }, [state.settings.reducedMotion]);

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

      // pre-awakening clicks ALWAYS produce Omens.
      if (!s.unlocked.awakened) {
        return { ...s, whispers: s.whispers + 1 };
      }

      // post-awakening clicks produce devotion burst
      const burst = c.clickDevotionBonus * c.clickFestivalMul * c.globalMul;
      return { ...s, devotion: s.devotion + burst };
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

  const spendOmens = () => {
    setState((s0) => {
      const s = migrateState(s0);
      if (!s.unlocked.awakened) return s;
      if (s.whispers < 1) return s;
      const spend = Math.min(10, s.whispers);
      return migrateState({
        ...s,
        whispers: s.whispers - spend,
        devotion: s.devotion + spend,
      });
    });
    showToast("Omens fade into Reverence.");
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
    if (state.ui.tab === TAB_SKY && !state.unlocked.sky) {
      setTab(TAB_VILLAGE);
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
    (state.sky?.starsong || 0) > 0;
  const omenSpend = Math.min(10, state.whispers);

  return (
    <div className="appRoot">
      <audio ref={audioRef} />
      <div ref={worldRef} style={{ position: "fixed", inset: 0 }}>
        <WorldCanvas
          mode={safeTab}
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
          pointerEvents: inMenu || tutorialOn ? "none" : "auto",
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
              <div className="statLabel">Omens</div>
              <div className="statValueSmall">{fmt(state.whispers)}</div>
            </div>

            <div className="statSub">
              Earned by clicking before you awaken.
              {awakened ? " Spend leftovers for a small Reverence burst." : ""}
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
                  className={tutorialStepData?.id === "seeker" ? "tutTarget" : ""}
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
            {awakened && state.whispers > 0 && (
              <div style={{ marginTop: 8 }}>
                <Button variant="secondary" onClick={spendOmens}>
                  Offer {omenSpend} Omens → +{omenSpend} Reverence
                </Button>
              </div>
            )}
          </div>

          <div className="statBox">
            <div className="rowBetween">
              <div className="statLabel">Reverence</div>
              <div className="statValueSmall">{fmt(state.devotion)}</div>
            </div>
            <div className="statSub">
              Rate: {fmt(computed.devotionRate)}/s {awakened ? "" : "(locked)"}
            </div>
          </div>

          <div className="statBox">
            <div className="rowBetween">
              <div className="statLabel">Authority</div>
              <div className="statValueSmall">{fmt(state.power)}</div>
            </div>
            <div className="statSub">
              Earned by conversion (and sky clicks later).
            </div>
            <div
              ref={convertBtnRef}
              className={tutorialStepData?.id === "convert" ? "tutTarget" : ""}
              style={{ marginTop: 8 }}
            >
              <Button
                variant="secondary"
                onClick={convert}
                disabled={!isConvertStep || !state.unlocked.convert || state.devotion < 10}
                title={
                  !isConvertStep
                    ? "Tutorial: conversion comes later"
                    : state.unlocked.convert
                    ? ""
                    : "Unlock by buying 1 Temple"
                }
              >
                Convert Reverence → Authority
              </Button>
            </div>
          </div>
        </Card>

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
              className={`tab ${safeTab === TAB_VILLAGE ? "tabActive" : ""} ${
                tutorialOn && !isVillageListStep ? "tabDisabled" : ""
              }`}
              onClick={() =>
                !tutorialOn || isVillageListStep ? setTab(TAB_VILLAGE) : null
              }
            >
              Village
            </button>
            <button
              ref={skyTabRef}
              className={`tab ${safeTab === TAB_SKY ? "tabActive" : ""} ${
                !isSkyTabStep || !state.unlocked.sky ? "tabDisabled" : ""
              } ${tutorialStepData?.id === "sky" ? "tutTarget" : ""}`}
              onClick={() =>
                isSkyTabStep && state.unlocked.sky && setTab(TAB_SKY)
              }
              title={
                !isSkyTabStep
                  ? "Tutorial: the Sky comes later"
                  : state.unlocked.sky
                  ? ""
                  : "Unlock by gaining Authority"
              }
            >
              Sky
            </button>
            <button
              className={`tab ${safeTab === TAB_CODEX ? "tabActive" : ""} ${
                tutorialOn ? "tabDisabled" : ""
              }`}
              onClick={() => !tutorialOn && setTab(TAB_CODEX)}
            >
              Codex
            </button>
          </div>

          {safeTab === TAB_VILLAGE && (
            <>
              <div className="smallText">
                Click the world for <b>{awakened ? "Reverence" : "Omens"}</b>.
                Buy upgrades with Reverence.
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
                            Cost: <b>{fmt(cost)}</b> Reverence
                          </div>
                          <Button disabled={!can} onClick={() => buy(u, "village")}>
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

          {safeTab === TAB_SKY && (
            <>
              {!isSkyTabStep ? (
                <div className="tinyMuted">
                  Tutorial: convert Reverence into Authority first. Then the Sky
                  will open.
                </div>
              ) : (
                <>
                  <div className="smallText">
                    Click the sky for Starlight. Buy upgrades with Authority.
                    Lower the Veil to reveal constellations.
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
                </>
              )}
            </>
          )}

          {safeTab === TAB_CODEX && (
            <div className="codex">
              <div className="codexTitle">Codex</div>
              <p>
                You are the still point in the long night. The village grows not
                because it must — but because you decide it should.
              </p>
              <p>
                The Veil is not weather. It is history. Peel it back, and the
                constellations become true.
              </p>
              <div className="codexBox">
                <div className="codexBoxTitle">Loop</div>
                <ul>
                  <li>Click world → Omens (until awakened)</li>
                  <li>Omens → Call Seeker</li>
                  <li>Followers → Reverence</li>
                  <li>Reverence → Village upgrades</li>
                  <li>Temple → Convert → Authority</li>
                  <li>Authority → Sky upgrades → Veil falls</li>
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
          rect={tutorialStepData.target?.()}
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
