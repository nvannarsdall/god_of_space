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

/* ============================================================
   INTRO MUSIC (AUTOPLAY-SAFE BOOTSTRAP)
   - Starts immediately (muted) so it accompanies the cutscene.
   - Unmutes on first user interaction (browser policy).
   ============================================================ */
if (typeof window !== "undefined" && !window.__gosIntroMusic) {
  const a = new Audio("/assets/audio/god_of_space_theme.wav");
  a.loop = true;
  a.volume = 0.7;
  a.muted = true;
  // Start muted playback immediately; browsers allow muted autoplay.
  a.currentTime = 0;
  a.play().catch(() => {});
  const unlock = () => {
    a.muted = false;
    a.play().catch(() => {});
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });
  window.__gosIntroMusic = a;
}

/* --- INTRO CUTSCENE --- */

function IntroCutscene({ onDone }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const [phase, setPhase] = useState("playing"); // playing | done

  // Timing (seconds)
  const TIMING = {
    fadeIn: 0.8,
    line1: [0.8, 4.2],
    line2: [4.2, 7.8],
    line3: [7.8, 11.2],
    line4: [11.2, 15.6],
    line5: [15.6, 19.0],
    fallStart: 8.4,
    impactAt: 10.1,
    flashDur: 0.2,
    bloomDur: 0.8,
    cutsceneEnd: 21.0,
  };

  const anim = useRef({
    start: 0,
    stars: [],
    embers: [],
    shards: [],
    didImpact: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    // Ensure intro music is running during the cutscene
    try {
      const a = window.__gosIntroMusic;
      if (a) a.play().catch(() => {});
    } catch {}

    const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    const clamp01 = (v) => Math.max(0, Math.min(1, v));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * DPR);
      canvas.height = Math.floor(rect.height * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };

    const seedStars = (W, H) => {
      const count = Math.floor((W * H) / 16000);
      anim.current.stars = Array.from({ length: count }, () => ({
        x: Math.random() * W,
        y: Math.random() * H * 0.75,
        a: 0.25 + Math.random() * 0.75,
        tw: Math.random() * 6.0,
      }));
    };

    resize();
    seedStars(canvas.clientWidth, canvas.clientHeight);

    const onResize = () => {
      resize();
      seedStars(canvas.clientWidth, canvas.clientHeight);
    };
    window.addEventListener("resize", onResize);

    const drawText = (ctx2, W, H, text, y, color = "#f4e6cf") => {
      // Centered, auto-fit + wrap (never cropped).
      ctx2.save();
      ctx2.setTransform(1, 0, 0, 1, 0, 0);
      ctx2.textAlign = "center";
      ctx2.textBaseline = "middle";

      const maxW = W * 0.88;
      const words = String(text).split(" ");

      const wrap2 = (size) => {
        ctx2.font = `${size}px "Press Start 2P", monospace`;
        if (ctx2.measureText(text).width <= maxW) return [text];

        let line1 = "";
        let i = 0;
        for (; i < words.length; i++) {
          const test = line1 ? `${line1} ${words[i]}` : words[i];
          if (ctx2.measureText(test).width <= maxW || !line1) line1 = test;
          else break;
        }
        const line2 = words.slice(i).join(" ");
        return line2 ? [line1, line2] : [line1];
      };

      let size = Math.max(14, Math.floor(W / 28));
      let lines = wrap2(size);
      while (size > 10) {
        ctx2.font = `${size}px "Press Start 2P", monospace`;
        const widest = Math.max(...lines.map((l) => ctx2.measureText(l).width));
        if (widest <= maxW) break;
        size -= 2;
        lines = wrap2(size);
      }

      const gap = size * 1.35;

      ctx2.fillStyle = "rgba(0,0,0,0.55)";
      lines.forEach((ln, i) => {
        const yy = y + (i - (lines.length - 1) / 2) * gap;
        ctx2.fillText(ln, W / 2 + 3, yy + 3);
      });

      ctx2.fillStyle = color;
      lines.forEach((ln, i) => {
        const yy = y + (i - (lines.length - 1) / 2) * gap;
        ctx2.fillText(ln, W / 2, yy);
      });

      ctx2.restore();
    };

    const drawArtifact = (ctx2, x, y, scale = 1.55, pulse = 0) => {
      const dx = Math.floor(x - 14 * scale);
      const dy = Math.floor(y - 28 * scale);

      const fill = (sx, sy, sw, sh, col, a = 1) => {
        ctx2.save();
        ctx2.globalAlpha = a;
        ctx2.fillStyle = col;
        ctx2.fillRect(dx + sx * scale, dy + sy * scale, sw * scale, sh * scale);
        ctx2.restore();
      };

      fill(9, 2, 10, 2, "#3b4362");
      fill(7, 4, 14, 4, "#2b3146");
      fill(6, 8, 16, 14, "#24283a");
      fill(7, 22, 14, 4, "#3b4362");

      fill(9, 2, 10, 1, "#11121a");
      fill(7, 4, 14, 1, "#11121a");
      fill(6, 8, 16, 1, "#11121a");
      fill(6, 21, 16, 1, "#11121a");
      fill(7, 25, 14, 1, "#11121a");
      fill(6, 8, 1, 18, "#11121a");
      fill(21, 8, 1, 18, "#11121a");

      fill(12, 7, 1, 12, "#6f7fb4", 0.7);
      fill(15, 9, 1, 10, "#6f7fb4", 0.55);

      const a = 0.35 + 0.55 * pulse;
      fill(12, 12, 4, 6, "#b9d7ff", a);
      fill(11, 15, 6, 2, "#ffe0b5", 0.25 + 0.55 * pulse);
    };

    const spawnImpact = (W, groundY) => {
      const ox = W * 0.5;
      const oy = groundY + 6;

      const N = 90;
      for (let i = 0; i < N; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 6.0 + Math.random() * 12.0;
        anim.current.shards.push({
          x: ox,
          y: oy,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp * 0.55 - (8.0 + Math.random() * 6.0),
          life: 80 + Math.random() * 50,
          sz: 1 + Math.floor(Math.random() * 2),
          hot: Math.random() < 0.55,
        });
      }

      const E = 38;
      for (let i = 0; i < E; i++) {
        anim.current.embers.push({
          x: ox + (Math.random() - 0.5) * 240,
          y: oy + (Math.random() - 0.5) * 12,
          vy: 2.2 + Math.random() * 4.2,
          life: 70 + Math.random() * 60,
        });
      }
    };

    const loop = (now) => {
      if (!anim.current.start) anim.current.start = now;
      const t = (now - anim.current.start) / 1000;

      const W = canvas.clientWidth;
      const H = canvas.clientHeight;

      if (phase !== "done" && t >= TIMING.cutsceneEnd) setPhase("done");

      ctx.clearRect(0, 0, W, H);

      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#0a0b12");
      sky.addColorStop(1, "#070812");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      anim.current.stars.forEach((s) => {
        const tw = 0.6 + 0.4 * Math.sin(t * s.tw + s.x * 0.01);
        ctx.globalAlpha = s.a * tw;
        ctx.fillStyle = "#cfd6ff";
        ctx.fillRect(Math.floor(s.x), Math.floor(s.y), 1, 1);
      });
      ctx.restore();

      const ridgeY = H * 0.68;
      ctx.fillStyle = "#070814";
      ctx.beginPath();
      ctx.moveTo(0, ridgeY + 40);
      ctx.lineTo(W * 0.28, ridgeY + 10);
      ctx.lineTo(W * 0.55, ridgeY + 45);
      ctx.lineTo(W * 0.78, ridgeY + 20);
      ctx.lineTo(W, ridgeY + 35);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();

      const groundY = ridgeY + 52;
      ctx.fillStyle = "#050510";
      ctx.fillRect(0, groundY, W, H - groundY);

      const fallT = clamp01(
        (t - TIMING.fallStart) / (TIMING.impactAt - TIMING.fallStart)
      );
      const gCurve = fallT * fallT; // accelerate into impact
      const startY = -H * 0.25;
      const endY = groundY + 6;
      const artifactY = startY + (endY - startY) * gCurve;

      // Atmospheric entry energy (tied to velocity), plus violent stochastic flicker
      const vel = clamp01(gCurve); // 0..1
      const energy = Math.pow(vel, 1.7);
      const flickerFall = 0.55 + Math.random() * 0.9; // violent
      const entryGlow = clamp01(energy * flickerFall);
      const pulse =
        t >= TIMING.impactAt
          ? 0.5 + 0.5 * Math.sin((t - TIMING.impactAt) * 5.0)
          : 0;
      const pulse01 =
        t >= TIMING.impactAt ? clamp01((t - TIMING.impactAt) / 1.4) * pulse : 0;

      if (t >= TIMING.fallStart) {
        const gx = W * 0.5;
        const gy = artifactY - 26;
        const r1 = 90;
        const g = ctx.createRadialGradient(gx, gy, 5, gx, gy, r1);
        const a0 = 0.05 + 0.1 * pulse01;
        const a1 = 0.02 + 0.06 * pulse01;
        g.addColorStop(0, `rgba(255,210,170,${a0})`);
        g.addColorStop(0.35, `rgba(255,210,170,${a1})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = g;
        ctx.fillRect(gx - r1, gy - r1, r1 * 2, r1 * 2);
        ctx.restore();

        // intense atmospheric sky + terrain illumination
        ctx.save();
        ctx.globalCompositeOperation = "screen";

        const glow = clamp01(pulse01) ** 0.6;

        // sky wash
        const skyGlow = ctx.createRadialGradient(
          W * 0.5,
          artifactY,
          0,
          W * 0.5,
          artifactY,
          800
        );
        skyGlow.addColorStop(0, `rgba(255,220,180,${0.35 * glow})`);
        skyGlow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = skyGlow;
        ctx.fillRect(0, 0, W, H);

        // ground illumination
        ctx.fillStyle = `rgba(255,200,150,${0.18 * glow})`;
        ctx.fillRect(0, groundY - 40, W, H);

        ctx.restore();

        // --- Atmospheric illumination (sky + terrain) while falling ---
        // Layered bloom + scattering column, intensity driven by entryGlow (velocity-based)
        ctx.save();
        ctx.globalCompositeOperation = "screen";

        const cx = W * 0.5;
        const cy = artifactY;
        const glow2 = clamp01(entryGlow);

        // 1) Hot core bloom (tight)
        const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 220);
        core.addColorStop(0, `rgba(255,250,240,${0.22 * glow2})`);
        core.addColorStop(0.25, `rgba(255,220,180,${0.14 * glow2})`);
        core.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = core;
        ctx.fillRect(0, 0, W, H);

        // 2) Wide sky wash (very soft)
        const wash = ctx.createRadialGradient(cx, cy, 80, cx, cy, 1400);
        wash.addColorStop(0, `rgba(255,210,165,${0.1 * glow2})`);
        wash.addColorStop(0.6, `rgba(255,185,140,${0.05 * glow2})`);
        wash.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = wash;
        ctx.fillRect(0, 0, W, H);

        // 3) Scattering column (downward-weighted)
        const col = ctx.createLinearGradient(0, cy - 180, 0, cy + 680);
        col.addColorStop(0, "rgba(0,0,0,0)");
        col.addColorStop(0.35, `rgba(255,220,180,${0.05 * glow2})`);
        col.addColorStop(0.65, `rgba(255,205,160,${0.12 * glow2})`);
        col.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = col;
        ctx.fillRect(0, 0, W, H);

        // 4) Terrain lift (subtle; avoids blown-out wash)
        ctx.fillStyle = `rgba(255,200,150,${0.04 * glow2})`;
        ctx.fillRect(0, groundY - 26, W, H - (groundY - 26));

        ctx.restore();

        drawArtifact(ctx, W * 0.5, artifactY, 1.55, pulse01);

        // --- Shock-heated plasma tail (rear-facing, noisy, flickering) ---
        if (t < TIMING.impactAt) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.lineWidth = 1;

          const tailN = 28;
          for (let i = 0; i < tailN; i++) {
            const t0 = i / tailN;
            const a =
              (1 - t0) *
              (0.18 + 0.35 * entryGlow) *
              (0.7 + Math.random() * 0.6);
            const y0 = artifactY - 6 - i * (10 + 14 * (1 - vel));
            const xJ = (Math.random() - 0.5) * (18 + 70 * t0);
            ctx.strokeStyle = `rgba(255,180,120,${a})`;
            ctx.beginPath();
            ctx.moveTo(W * 0.5, y0);
            ctx.lineTo(W * 0.5 + xJ, y0 - (26 + 38 * t0));
            ctx.stroke();
          }

          // Occasional fragmentation flash (brief, subtle)
          if (Math.random() < 0.1 * entryGlow) {
            ctx.globalAlpha = 0.06 * entryGlow;
            ctx.fillStyle = "rgba(255,245,235,1)";
            ctx.fillRect(0, 0, W, H);
          }

          ctx.restore();
        }
      }

      if (t >= TIMING.impactAt) {
        const dt = t - TIMING.impactAt;

        if (!anim.current.didImpact) {
          anim.current.didImpact = true;
          spawnImpact(W, groundY);
        }

        if (dt <= TIMING.flashDur) {
          const a = 1 - dt / TIMING.flashDur;
          ctx.save();
          ctx.globalAlpha = 0.95 * a;
          ctx.fillStyle = "rgba(255,248,235,1)";
          ctx.fillRect(0, 0, W, H);
          ctx.restore();
        }

        if (dt <= TIMING.bloomDur) {
          const a = 1 - dt / TIMING.bloomDur;
          const bx = W * 0.5;
          const by = groundY + 6;
          const br = 70 + dt * 420;
          const gg = ctx.createRadialGradient(bx, by, 10, bx, by, br);
          gg.addColorStop(0, "rgba(255,250,240,1)");
          gg.addColorStop(0.22, "rgba(255,210,165,0.85)");
          gg.addColorStop(0.55, "rgba(255,170,120,0.22)");
          gg.addColorStop(1, "rgba(0,0,0,0)");
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          ctx.globalAlpha = 0.55 * a;
          ctx.fillStyle = gg;
          ctx.fillRect(bx - br, by - br, br * 2, br * 2);
          ctx.restore();
        }
      }

      anim.current.shards = anim.current.shards.filter((p) => p.life > 0);
      anim.current.shards.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.26;
        p.vx *= 0.992;
        p.vy *= 0.992;
        p.life -= 1;

        const a = clamp01(p.life / 120);
        ctx.save();
        ctx.globalAlpha = (p.hot ? 0.9 : 0.55) * a;
        ctx.strokeStyle = p.hot ? "rgba(255,220,170,1)" : "rgba(200,210,235,1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * 1.2, p.y - p.vy * 1.2);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.fillStyle = p.hot ? "rgba(255,245,235,1)" : "rgba(220,235,255,1)";
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.sz, p.sz);
        ctx.restore();
      });

      anim.current.embers = anim.current.embers.filter((e) => e.life > 0);
      anim.current.embers.forEach((e) => {
        e.y -= e.vy;
        e.vy *= 0.985;
        e.life -= 1;
        const a = clamp01(e.life / 120);
        ctx.save();
        ctx.globalAlpha = 0.55 * a;
        ctx.fillStyle = "rgba(255,200,140,1)";
        ctx.fillRect(Math.round(e.x), Math.round(e.y), 2, 2);
        ctx.restore();
      });

      const y = H * 0.28;
      const fade = clamp01((t - 0.4) / TIMING.fadeIn);
      ctx.save();
      ctx.globalAlpha = fade;
      if (t >= TIMING.line1[0] && t < TIMING.line1[1])
        drawText(ctx, W, H, "A GOD HAS FALLEN.", y);
      if (t >= TIMING.line2[0] && t < TIMING.line2[1])
        drawText(ctx, W, H, "ITS POWER IS SHATTERED.", y, "#f2b97d");
      if (t >= TIMING.line3[0] && t < TIMING.line3[1])
        drawText(ctx, W, H, "A RELIC IS CAST DOWN TO THE WORLD.", y, "#f5d3a7");
      if (t >= TIMING.line4[0] && t < TIMING.line4[1])
        drawText(ctx, W, H, "MORTALS CAN RESTORE WHAT WAS LOST.", y, "#d9e8ff");
      if (t >= TIMING.line5[0])
        drawText(ctx, W, H, "BEGIN AT THE DUSK.", y, "#f5e1c5");
      ctx.restore();

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [phase]);

  return (
    <div className="introCanvasWrap">
      <canvas ref={canvasRef} className="introCanvas" />

      {phase === "done" && (
        <div className="introOverlay">
          <div className="introBrand">GOD OF SPACE</div>
          <div className="introSub">
            A nameless god. A village. A sky to rebuild.
          </div>
          <button
            className="btn btnPrimary"
            onClick={() => {
              setPhase("done");
              onDone?.();
            }}
          >
            ENTER THE DUSK
          </button>
        </div>
      )}

      <style>{`
        .introCanvasWrap{position:relative;width:100%;height:100%;overflow:hidden;background:#000;}
        .introCanvas{width:100%;height:100%;display:block;image-rendering:pixelated;}
        .introOverlay{
          position:absolute;left:50%;bottom:34px;transform:translateX(-50%);
          display:flex;flex-direction:column;align-items:center;gap:10px;
          background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.14);
          box-shadow:0 10px 30px rgba(0,0,0,0.6);
          padding:44px 34px;border-radius:10px;backdrop-filter:blur(2px);
        }
        .introBrand{font-family:"Press Start 2P", monospace;font-size:28px;letter-spacing:1px;color:#f4e6cf;}
        .introSub{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size:14px;color:rgba(244,230,207,0.85);text-align:center;max-width:520px;line-height:1.4;}
        .btn{cursor:pointer;border:none}
        .btnPrimary{
          font-family:"Press Start 2P", monospace;
          font-size:20px;padding:14px 26px;border-radius:6px;
          background:#4aa3ff;color:#08101a;border:2px solid rgba(255,255,255,0.35);
          box-shadow:0 8px 0 rgba(0,0,0,0.35);
        }
        .btnPrimary:active{transform:translateY(2px);box-shadow:0 6px 0 rgba(0,0,0,0.35);}
      `}</style>
    </div>
  );
}
export default function App() {
  const [state, setState] = useState(() => {
    const loaded = loadState();
    const merged = loaded ? deepMerge(baseState(), loaded) : baseState();
    return migrateState(merged);
  });

  const showIntro = !state.ui.introSeen && !state.ui?.tutorialActive;
  const computed = useMemo(() => compute(state), [state]);
  const [toast, setToast] = useState(null);

  // Audio & Refs
  const audioRef = useRef(null);

  // ---- Intro music (muted autoplay, unmute on interaction) ----
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    el.src = "/assets/audio/god_of_space_theme.wav";
    el.loop = true;
    el.volume = 0.7;
    el.muted = true;

    const play = () => el.play().catch(() => {});
    play();

    const unlock = () => {
      el.muted = false;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
  const urlsRef = useRef([]);
  const [playlist, setPlaylist] = useState([]);
  const [track, setTrack] = useState(0);

  const worldRef = useRef(null);
  const seekerBtnRef = useRef(null);
  const statusRef = useRef(null);
  const upgradesRef = useRef(null);
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
  const isSkyTabStep = tutorialOn ? Boolean(tutorialAllows.skyTab) : true;
  const isSkyUpgradeStep = tutorialOn
    ? Boolean(tutorialAllows.skyUpgrades)
    : true;
  const isSeekerStep = tutorialOn ? Boolean(tutorialAllows.seeker) : true;
  const inMenu = false;
  const leftHudPE = "auto";
  const rightPanelPE = "auto";

  // Unlock the Sky tab mid-tutorial (slow reveal)
  useEffect(() => {
    if (!tutorialOn) return;
    const step = state.ui?.tutorialStep || 0;
    if (step >= 6 && !state.unlocked.sky) {
      setState((s) =>
        migrateState({ ...s, unlocked: { ...s.unlocked, sky: true } })
      );
    }
  }, [tutorialOn, state.ui?.tutorialStep, state.unlocked.sky]);
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
          stardust: s.stardust,
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

  // Start/continue soundtrack in-game (and stop any intro bootstrap audio)
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    // Stop bootstrap intro audio if it exists (prevents double playback)
    try {
      const intro = window.__gosIntroMusic;
      if (intro) {
        // carry time if possible
        const t = intro.currentTime || 0;
        intro.pause();
        window.__gosIntroMusic = null;
        // set game audio to same time for continuity
        el.currentTime = Math.max(0, Math.min(t, 9999));
      }
    } catch {}

    // Ensure a valid source is set.
    if (!el.src || !String(el.src).includes("god_of_space_theme")) {
      el.src = "/assets/audio/god_of_space_theme.wav";
      try {
        el.load();
      } catch {}
    }

    if (state.settings.musicEnabled) {
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  }, [state.settings.musicEnabled]);

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
      const base = 0.2 * c.telescopeBonus * c.starlightBonus;
      const stardust = s.stardust + base;
      return migrateState({ ...s, stardust });
    });
  };

  const canCallSeeker = !awakened && state.whispers >= seekerCost;
  const callSeeker = () => {
    let did = false;
    let failReason = "";
    setState((s0) => {
      const s = migrateState(s0);

      // During the tutorial, the Seeker action is intended for the "seeker" step (index 2).
      if (tutorialOn && (s.ui?.tutorialStep ?? 0) !== 2) {
        failReason = "Follow the tutorial steps first.";
        return s;
      }

      if (s.unlocked.awakened) {
        failReason = "You are already awakened.";
        return s;
      }
      if (s.whispers < seekerCost) {
        failReason = `Need ${seekerCost} Omens.`;
        return s;
      }

      did = true;
      return migrateState({
        ...s,
        whispers: s.whispers - seekerCost,
        followers: Math.max(1, s.followers),
        unlocked: { ...s.unlocked, awakened: true },
      });
    });

    if (did) showToast("A Seeker enters the dusk.");
    else if (failReason) showToast(failReason);
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
        if (step < 4) return s;
        if (step === 4 && u.id !== "starsong") return s;
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
      if (s.stardust < cost) return s;
      return migrateState({
        ...s,
        stardust: s.stardust - cost,
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
    } catch {}
    window.location.reload();
  };

  const replayIntro = () => {
    setState((s) => ({
      ...s,
      ui: { ...s.ui, introSeen: false, screen: "menu" },
    }));
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
      introSeen: true,
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
          // Start the tutorial immediately after the intro (no menu).
          setState((s0) => {
            const keep = s0.settings;
            const next = baseState();
            next.settings = { ...keep, musicEnabled: true };
            next.ui = {
              ...next.ui,
              screen: "tutorial",
              tutorialActive: true,
              tutorialStep: 0,
              tutorialHidden: false,
              tab: "village",
              introSeen: true,
              settingsOpen: false,
            };
            try {
              localStorage.removeItem(LS_KEY);
            } catch {}
            return migrateState(next);
          });
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
            <Button
              variant="secondary"
              onClick={() =>
                setState((s) => ({ ...s, ui: { ...s.ui, settingsOpen: true } }))
              }
              title="Settings"
            >
              Settings
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
                    src="/assets/pixel/icon_starlight.png"
                    alt=""
                  />{" "}
                  Starlight
                </div>
                <div className="statValueSmall">{fmt(state.stardust)}</div>
              </div>
              <div className="statSub" style={{ marginTop: 6 }}>
                Earned by clicking the sky.
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
                if (tutStep === 4) return u.id === "starsong";
                return true;
              }).map((u) => {
                const lvl = state.sky[u.id] || 0;
                const cost = upgradeCost(u.baseCost, u.growth, lvl);
                const can = state.stardust >= cost && isSkyUpgradeStep;
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
                        Cost: <b>{fmt(cost)}</b> Starlight
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

      {state.ui?.settingsOpen && (
        <div className="menuOverlay" style={{ pointerEvents: "auto" }}>
          <div className="menuCard" style={{ maxWidth: 520 }}>
            <div className="menuTitle">Settings</div>
            <div className="menuSub">Audio</div>

            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={Boolean(state.settings.musicEnabled)}
                  onChange={(e) =>
                    setState((s) =>
                      migrateState({
                        ...s,
                        settings: {
                          ...s.settings,
                          musicEnabled: e.target.checked,
                        },
                      })
                    )
                  }
                />
                <span
                  style={{
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: 12,
                  }}
                >
                  Music Enabled
                </span>
              </label>

              <div style={{ display: "grid", gap: 6 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontFamily: '"Press Start 2P", monospace',
                      fontSize: 12,
                    }}
                  >
                    Music Volume
                  </span>
                  <span
                    style={{
                      fontFamily: '"Press Start 2P", monospace',
                      fontSize: 12,
                      opacity: 0.8,
                    }}
                  >
                    {Math.round((state.settings.musicVolume ?? 0.65) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={state.settings.musicVolume ?? 0.65}
                  onChange={(e) =>
                    setState((s) =>
                      migrateState({
                        ...s,
                        settings: {
                          ...s.settings,
                          musicVolume: Number(e.target.value),
                          musicEnabled: true,
                        },
                      })
                    )
                  }
                />
              </div>
            </div>

            <div className="menuButtons" style={{ marginTop: 18 }}>
              <button
                className="btn btnPrimary"
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    ui: { ...s.ui, settingsOpen: false },
                  }))
                }
              >
                CLOSE
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
