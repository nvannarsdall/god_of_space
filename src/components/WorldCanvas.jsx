import React, { useEffect, useMemo, useRef } from "react";
import { clamp } from "../game/state";

// Resolution: 2 = Sharp Hi-Bit Pixel Art.
const PIXEL_SCALE = 2;
const TOTEM_TARGET = { x: 0.52, y: 0.7 };

function makeStars(seed) {
  let t = (seed >>> 0) + 0x6d2b79f5;
  const rnd = () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const layers = [
    { n: 120, sp: 0.005, a: 0.5 },
    { n: 80, sp: 0.01, a: 0.4 },
    { n: 50, sp: 0.02, a: 0.3 },
  ];
  return layers.map((L) =>
    Array.from({ length: L.n }).map(() => ({
      x: rnd(),
      y: rnd(),
      a: L.a * (0.65 + rnd() * 0.6),
      sp: L.sp * (0.8 + rnd() * 0.4),
    }))
  );
}

function WorldCanvas({ mode, state, computed, onClickVillage, onClickSky }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const spritesRef = useRef({ imgs: {}, ready: false });
  const fxRef = useRef([]);
  const fxIdRef = useRef(0);

  const stateRef = useRef(state);
  const computedRef = useRef(computed);
  const modeRef = useRef(mode);

  useEffect(() => {
    stateRef.current = state;
    computedRef.current = computed;
    modeRef.current = mode;
  }, [state, computed, mode]);

  const stars = useMemo(() => makeStars(state.seed || 999), []);
  const constellationSets = useMemo(
    () => [
      {
        id: "starsong",
        points: [
          { x: 0.18, y: 0.24 },
          { x: 0.28, y: 0.36 },
          { x: 0.42, y: 0.26 },
          { x: 0.54, y: 0.34 },
        ],
      },
      {
        id: "orbits",
        points: [
          { x: 0.62, y: 0.22 },
          { x: 0.74, y: 0.3 },
          { x: 0.84, y: 0.18 },
          { x: 0.9, y: 0.28 },
        ],
      },
      {
        id: "telescope",
        points: [
          { x: 0.12, y: 0.48 },
          { x: 0.22, y: 0.56 },
          { x: 0.32, y: 0.5 },
          { x: 0.42, y: 0.6 },
        ],
      },
      {
        id: "transcend",
        points: [
          { x: 0.58, y: 0.52 },
          { x: 0.68, y: 0.6 },
          { x: 0.78, y: 0.52 },
          { x: 0.88, y: 0.6 },
        ],
      },
      {
        id: "crown",
        points: [
          { x: 0.32, y: 0.18 },
          { x: 0.4, y: 0.1 },
          { x: 0.48, y: 0.18 },
        ],
      },
    ],
    []
  );

  // --- FX HANDLERS ---
  const addRipple = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    fxRef.current.push({
      id: ++fxIdRef.current,
      kind: "ripple",
      x,
      y,
      t0: performance.now(),
    });
  };
  const addFloat = (x, y, text) => {
    fxRef.current.push({
      id: ++fxIdRef.current,
      kind: "float",
      x,
      y,
      t0: performance.now(),
      text,
    });
  };
  const addMotesTo = (x0, y0, x1, y1, hue, n) => {
    const now = performance.now();
    for (let i = 0; i < n; i++) {
      fxRef.current.push({
        id: ++fxIdRef.current,
        kind: "mote",
        x0: x0 + (Math.random() - 0.5) * 0.05,
        y0: y0 + (Math.random() - 0.5) * 0.05,
        x1: x1 + (Math.random() - 0.5) * 0.05,
        y1: y1 + (Math.random() - 0.5) * 0.05,
        t0: now + i * 20,
        dur: 500 + Math.random() * 400,
        hue,
      });
    }
  };

  // --- ASSET LOADER ---
  useEffect(() => {
    const load = (name, url) =>
      new Promise((resolve) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve({ name, img });
        img.onerror = () => resolve({ name, img: null });
      });
    const base = "/assets/pixel";
    Promise.all([
      load("temple", `${base}/spr_temple.png`),
      load("follower", `${base}/spr_follower.png`),
    ]).then((items) => {
      const imgs = {};
      for (const it of items) if (it.img) imgs[it.name] = it.img;
      spritesRef.current = { imgs, ready: true };
    });
  }, []);

  // --- RENDER LOOP ---
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");

    const dither = (x, y) => (Math.floor(x) + Math.floor(y)) % 2 === 0;

    const drawSpriteOrRect = (name, x, y, w, h, col, scale = 2.0) => {
      const img = spritesRef.current.imgs[name];
      if (img) {
        const dx = Math.floor(x - (img.width * scale) / 2);
        const dy = Math.floor(y - img.height * scale);
        const sw = img.width * scale;
        const sh = img.height * scale;

        ctx.drawImage(img, dx, dy, sw, sh);
      } else {
        ctx.fillStyle = col;
        ctx.fillRect(Math.floor(x - w / 2), Math.floor(y - h), w, h);
      }
    };

    const drawHouse = (x, y, scale = 2.0, lit = true) => {
      const palette = lit
        ? {
            outline: "#151724",
            roof: "#7e5c88",
            roofShadow: "#6a4a7a",
            wall: "#464c6c",
            door: "#1f2230",
            window: "#a0c4d8",
            trim: "#c4cede",
          }
        : {
            outline: "#0a0b12",
            roof: "#42304c",
            roofShadow: "#34243e",
            wall: "#202434",
            door: "#14141e",
            window: "#50606e",
            trim: "#6e7682",
          };

      const width = 32;
      const height = 32;
      const dx = Math.floor(x - (width * scale) / 2);
      const dy = Math.floor(y - height * scale);
      const s = scale;

      const fill = (sx, sy, sw, sh, col) => {
        ctx.fillStyle = col;
        ctx.fillRect(dx + sx * s, dy + sy * s, sw * s, sh * s);
      };

      // Roof (stepped slope)
      fill(6, 6, 20, 2, palette.roofShadow);
      fill(5, 8, 22, 2, palette.roofShadow);
      fill(4, 10, 24, 2, palette.roofShadow);
      fill(3, 12, 26, 2, palette.roof);
      fill(2, 14, 28, 3, palette.roof);

      // Chimney
      fill(21, 4, 4, 6, palette.roofShadow);
      fill(21, 4, 4, 1, palette.outline);

      // House body
      fill(6, 17, 20, 12, palette.wall);
      fill(6, 17, 20, 1, palette.outline);
      fill(6, 28, 20, 1, palette.outline);
      fill(6, 17, 1, 12, palette.outline);
      fill(25, 17, 1, 12, palette.outline);

      // Door
      fill(14, 21, 4, 8, palette.door);
      fill(14, 21, 4, 1, palette.outline);
      fill(14, 28, 4, 1, palette.outline);
      fill(14, 21, 1, 8, palette.outline);
      fill(17, 21, 1, 8, palette.outline);
      fill(16, 25, 1, 1, palette.trim);

      // Window
      fill(9, 21, 4, 4, palette.window);
      fill(9, 21, 4, 1, palette.outline);
      fill(9, 24, 4, 1, palette.outline);
      fill(9, 21, 1, 4, palette.outline);
      fill(12, 21, 1, 4, palette.outline);
      fill(10, 22, 1, 1, palette.trim);
      fill(11, 23, 1, 1, palette.trim);
    };

    const drawMonolith = (x, y, scale = 2.6, lit = true) => {
      const palette = lit
        ? {
            outline: "#11121d",
            base: "#2a2f43",
            core: "#6e7fb0",
            glow: "#ffe4b5",
            trim: "#8a94b8",
          }
        : {
            outline: "#0a0b12",
            base: "#1a1c2b",
            core: "#333a52",
            glow: "#8e8b74",
            trim: "#464b66",
          };

      const width = 26;
      const height = 38;
      const dx = Math.floor(x - (width * scale) / 2);
      const dy = Math.floor(y - height * scale);
      const s = scale;

      const fill = (sx, sy, sw, sh, col) => {
        ctx.fillStyle = col;
        ctx.fillRect(dx + sx * s, dy + sy * s, sw * s, sh * s);
      };

      // Base
      fill(2, 28, 22, 6, palette.base);
      fill(2, 28, 22, 1, palette.outline);
      fill(2, 33, 22, 1, palette.outline);
      fill(2, 28, 1, 6, palette.outline);
      fill(23, 28, 1, 6, palette.outline);

      // Pillar
      fill(8, 6, 10, 22, palette.core);
      fill(8, 6, 10, 1, palette.outline);
      fill(8, 27, 10, 1, palette.outline);
      fill(8, 6, 1, 22, palette.outline);
      fill(17, 6, 1, 22, palette.outline);
      fill(9, 10, 8, 2, palette.trim);
      fill(10, 13, 6, 2, palette.trim);
      fill(11, 16, 4, 2, palette.trim);

      // Core glow
      fill(12, 19, 2, 4, palette.glow);
      fill(11, 23, 4, 2, palette.glow);
    };

    const loop = (now) => {
      // 0. RESET TRANSFORM (Critical fix for gliding)
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // 1. RESIZE
      const rect = wrapRef.current.getBoundingClientRect();
      const W = Math.ceil(rect.width / PIXEL_SCALE);
      const H = Math.ceil(rect.height / PIXEL_SCALE);

      if (c.width !== W || c.height !== H) {
        c.width = W;
        c.height = H;
        ctx.imageSmoothingEnabled = false;
      }

      const st = stateRef.current;
      const t = st.settings?.reducedMotion ? 0 : now / 1000;
      const veil = computedRef.current?.veil || 1;

      const isSkyMode = modeRef.current === "sky";

      // 2. SKY
      ctx.fillStyle = "#05040a";
      ctx.fillRect(0, 0, W, H);

      if (isSkyMode) {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#05040a");
        grad.addColorStop(0.5, "#0d1020");
        grad.addColorStop(1, "#0b0b16");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        const reveal = clamp(1 - veil, 0.05, 1);
        ctx.fillStyle = "#eaf2ff";
        stars.forEach((layer) => {
          layer.forEach((star) => {
            const a = star.a * (0.1 + reveal * 0.9);
            if (a < 0.06) return;
            const x = (star.x * W + t * 2 * star.sp) % W;
            const y = (star.y * H) % H;
            if (Math.random() < a) {
              ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
            }
          });
        });

        const drawConstellation = (points, alpha) => {
          if (points.length < 2) return;
          ctx.save();
          ctx.strokeStyle = `rgba(140, 185, 255, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          points.forEach((p, i) => {
            const x = p.x * W;
            const y = p.y * H;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();
          ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`;
          points.forEach((p) => {
            ctx.fillRect(Math.round(p.x * W), Math.round(p.y * H), 2, 2);
          });
          ctx.restore();
        };

        const skyLevels = st.sky || {};
        constellationSets.forEach((set) => {
          if ((skyLevels[set.id] || 0) <= 0) return;
          drawConstellation(set.points, 0.25 + reveal * 0.5);
        });

        if (veil > 0.08) {
          ctx.fillStyle = `rgba(10, 12, 20, ${veil * 0.85})`;
          ctx.fillRect(0, 0, W, H);
        }
      } else {
        const skyH = H * 0.68;
        for (let y = 0; y < skyH; y += 2) {
          const p = y / skyH;
          if (p < 0.25) {
            ctx.fillStyle = "#15192b";
            ctx.fillRect(0, y, W, 2);
          } else if (p < 0.55 && dither(0, y / 2)) {
            ctx.fillStyle = "#121726";
            ctx.fillRect(0, y, W, 2);
          } else if (p < 0.85 && dither(1, y / 2)) {
            ctx.fillStyle = "#0e1322";
            ctx.fillRect(0, y, W, 2);
          }
        }

        // 3. GROUND (Made slightly lighter to ensure visibility)
        const groundY = Math.floor(H * 0.75);

        // Mountains (Solid Color - Fixes the "gliding" transparency issue)
        ctx.fillStyle = "#0d0f1b";
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        for (let x = 0; x <= W; x += 8) {
          const ridge = 16 + Math.abs(Math.sin(x * 0.035)) * 18;
          ctx.lineTo(x, groundY - ridge);
        }
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.fill();

        // Far ridge highlight
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = "#1f2434";
        ctx.beginPath();
        ctx.moveTo(0, groundY - 14);
        for (let x = 0; x <= W; x += 10) {
          const ridge = 18 + Math.abs(Math.sin(x * 0.03 + 1.2)) * 14;
          ctx.lineTo(x, groundY - ridge);
        }
        ctx.stroke();
        ctx.restore();

        // Foreground Ground
        ctx.fillStyle = "#090812";
        ctx.fillRect(0, groundY, W, H - groundY);
        // Horizon Line
        ctx.fillStyle = "#2a2c3b";
        ctx.fillRect(0, groundY, W, 2);

        // Ember glow in the sky near the horizon
        const glow = ctx.createRadialGradient(
          W * 0.5,
          groundY - 20,
          10,
          W * 0.5,
          groundY - 20,
          180
        );
        glow.addColorStop(0, "rgba(255,196,146,0.2)");
        glow.addColorStop(1, "rgba(255,196,146,0)");
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, groundY + 40);
        ctx.restore();

        // 4. ENTITIES
        const huts = st.village.huts || 0;
        const temples = st.village.temples || 0;

        const lit = st.devotion > 0;
        // Main Hut (Y + 4 to sit on ground)
        drawHouse(W * 0.26, groundY + 6, 2.4, lit);
        if (lit) {
          ctx.save();
          const hutGlow = ctx.createRadialGradient(
            W * 0.26,
            groundY - 12,
            8,
            W * 0.26,
            groundY - 12,
            70
          );
          hutGlow.addColorStop(0, "rgba(255,220,160,0.35)");
          hutGlow.addColorStop(1, "rgba(255,220,160,0)");
          ctx.globalCompositeOperation = "screen";
          ctx.fillStyle = hutGlow;
          ctx.fillRect(W * 0.16, groundY - 80, W * 0.2, 140);
          ctx.restore();
        }

        // Central monolith (main focal point)
        drawMonolith(W * 0.56, groundY + 10, 2.8, lit);
        ctx.save();
        const monolithGlow = ctx.createRadialGradient(
          W * 0.56,
          groundY - 8,
          20,
          W * 0.56,
          groundY - 8,
          160
        );
        monolithGlow.addColorStop(
          0,
          lit ? "rgba(255,214,168,0.4)" : "rgba(160,170,200,0.25)"
        );
        monolithGlow.addColorStop(1, "rgba(255,214,168,0)");
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = monolithGlow;
        ctx.fillRect(W * 0.4, groundY - 140, W * 0.32, 220);
        ctx.restore();

        for (let i = 0; i < Math.min(huts, 12); i++) {
          const hx = W * (0.35 + i * 0.05);
          const hy = groundY + 8 + (i % 2) * 4;
          drawHouse(hx, hy, 1.6, false);
        }

        if (temples > 0)
          drawSpriteOrRect(
            "temple",
            W * 0.85,
            groundY + 8,
            30,
            50,
            "#555",
            2.6
          );

        const followers = Math.min(Math.floor(st.followers), 25);
        for (let i = 0; i < followers; i++) {
          const walk = Math.sin(t * 3 + i * 13) * 2;
          const fx = W * (0.2 + i * 0.025) + walk;
          drawSpriteOrRect("follower", fx, groundY + 8, 4, 8, "#dfe7ff", 0.9);
        }
      }

      // 5. FX PARTICLES
      fxRef.current = fxRef.current.filter((p) => now - p.t0 < (p.dur || 1000));
      fxRef.current.forEach((p) => {
        const age = Math.max(0, now - p.t0);

        if (p.kind === "mote") {
          const prog = age / p.dur;
          const x = p.x0 + (p.x1 - p.x0) * prog;
          const y = p.y0 + (p.y1 - p.y0) * prog;
          ctx.fillStyle = p.hue === "sky" ? "#57a9ff" : "#57ff99";
          ctx.fillRect(Math.round(x * W), Math.round(y * H), 1, 1);
        } else if (p.kind === "ripple") {
          const r = Math.max(0.1, (age / 1000) * 25);
          ctx.strokeStyle = `rgba(255,255,255,${1 - age / 1000})`;
          ctx.beginPath();
          ctx.arc(p.x * W, p.y * H, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      // 6. FLOATING TEXT
      fxRef.current.forEach((p) => {
        if (p.kind !== "float") return;
        const age = Math.max(0, now - p.t0);
        ctx.font = '5px "Press Start 2P", sans-serif';
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        const floatY = p.y * H - age / 50;
        ctx.fillText(p.text, Math.floor(p.x * W), Math.floor(floatY));
      });

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [stars, constellationSets]);

  const handleClick = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);

    addRipple(x, y);

    if (mode === "sky") {
      addMotesTo(x, y, 0.5, 0.3, "sky", 5);
      addFloat(x, y, "+Starlight");
      onClickSky();
    } else {
      addMotesTo(x, y, TOTEM_TARGET.x, TOTEM_TARGET.y, "village", 5);
      addFloat(x, y, "+Omen");
      onClickVillage();
    }
  };

  return (
    <div
      ref={wrapRef}
      className="world"
      onPointerDown={handleClick}
      style={{ cursor: "crosshair" }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", imageRendering: "pixelated" }}
      />
    </div>
  );
}

export default WorldCanvas;
