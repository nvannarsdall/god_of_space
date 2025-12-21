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
  const constellation = useMemo(
    () => [
      { x: 0.16, y: 0.22 },
      { x: 0.28, y: 0.38 },
      { x: 0.43, y: 0.26 },
      { x: 0.61, y: 0.4 },
      { x: 0.73, y: 0.24 },
      { x: 0.86, y: 0.44 },
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
      load("house", `${base}/spr_house.png`),
      load("houseDark", `${base}/spr_house_dark.png`),
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

        // DRAW BACKING RECT to plug holes (fixes the "3 dots" issue)
        ctx.fillStyle = "#0b0a10"; // Dark background color
        // Inset slightly so it doesn't bleed out edges
        ctx.fillRect(dx + 2, dy + 2, sw - 4, sh - 4);

        ctx.drawImage(img, dx, dy, sw, sh);
      } else {
        ctx.fillStyle = col;
        ctx.fillRect(Math.floor(x - w / 2), Math.floor(y - h), w, h);
      }
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

      // 2. SKY
      ctx.fillStyle = "#05040a";
      ctx.fillRect(0, 0, W, H);

      const skyH = H * 0.65;
      for (let y = 0; y < skyH; y += 2) {
        const p = y / skyH;
        if (p < 0.25) {
          ctx.fillStyle = "#1a1c2c";
          ctx.fillRect(0, y, W, 2);
        } else if (p < 0.55 && dither(0, y / 2)) {
          ctx.fillStyle = "#1a1c2c";
          ctx.fillRect(0, y, W, 2);
        }
      }

      // Stars
      ctx.fillStyle = "#eaf2ff";
      stars.forEach((layer) => {
        layer.forEach((star) => {
          const a = star.a * (1 - veil * 0.9);
          if (a < 0.1) return;
          const x = (star.x * W + t * 2 * star.sp) % W;
          const y = (star.y * H) % H;
          if (Math.random() < a)
            ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
        });
      });

      if (veil > 0.05) {
        ctx.fillStyle = `rgba(15, 14, 20, ${veil * 0.85})`;
        ctx.fillRect(0, 0, W, H);
      }

      // 3. GROUND (Made slightly lighter to ensure visibility)
      const groundY = Math.floor(H * 0.75);

      // Mountains (Solid Color - Fixes the "gliding" transparency issue)
      ctx.fillStyle = "#111218";
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      for (let x = 0; x <= W; x += 8) {
        ctx.lineTo(x, groundY - 8 - Math.abs(Math.sin(x * 0.04)) * 12);
      }
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.fill();

      // Foreground Ground
      ctx.fillStyle = "#0b0a10";
      ctx.fillRect(0, groundY, W, H - groundY);
      // Horizon Line
      ctx.fillStyle = "#333544";
      ctx.fillRect(0, groundY, W, 2);

      // 4. ENTITIES
      const huts = st.village.huts || 0;
      const temples = st.village.temples || 0;

      const lit = st.devotion > 0 && Math.sin(t * 2) > 0;
      // Main Hut (Y + 4 to sit on ground)
      drawSpriteOrRect(
        lit ? "house" : "houseDark",
        W * 0.25,
        groundY + 4,
        24,
        18,
        "#444",
        2.0
      );

      for (let i = 0; i < Math.min(huts, 12); i++) {
        const hx = W * (0.35 + i * 0.05);
        const hy = groundY + 6 + (i % 2) * 4;
        drawSpriteOrRect("houseDark", hx, hy, 20, 16, "#333", 1.8);
      }

      if (temples > 0)
        drawSpriteOrRect("temple", W * 0.85, groundY + 6, 30, 50, "#555", 2.0);

      const followers = Math.min(Math.floor(st.followers), 25);
      for (let i = 0; i < followers; i++) {
        const walk = Math.sin(t * 3 + i * 13) * 2;
        const fx = W * (0.2 + i * 0.025) + walk;
        drawSpriteOrRect("follower", fx, groundY + 14, 6, 12, "#fff", 2.0);
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
  }, [stars]);

  const handleClick = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);

    addRipple(x, y);

    if (mode === "sky") {
      addMotesTo(x, y, 0.5, 0.3, "sky", 5);
      addFloat(x, y, "+Star");
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
