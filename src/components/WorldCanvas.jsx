import React, { useEffect, useMemo, useRef } from "react";
import { clamp } from "../game/state";

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.min(Math.abs(w), Math.abs(h)) / 2));
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, rr);
    return;
  }
  const x2 = x + w;
  const y2 = y + h;
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x2, y, x2, y2, rr);
  ctx.arcTo(x2, y2, x, y2, rr);
  ctx.arcTo(x, y2, x, y, rr);
  ctx.arcTo(x, y, x2, y, rr);
  ctx.closePath();
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function makeStars(seed) {
  // tiny seeded-ish rng
  let t = (seed >>> 0) + 0x6d2b79f5;
  const rnd = () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };

  const layers = [
    { n: 140, sp: 0.007, a: 0.55, s: 1.2 },
    { n: 100, sp: 0.011, a: 0.4, s: 1.8 },
    { n: 70, sp: 0.016, a: 0.3, s: 2.4 },
  ];

  return layers.map((L) =>
    Array.from({ length: L.n }).map(() => ({
      x: rnd(),
      y: rnd(),
      tw: rnd() * Math.PI * 2,
      a: L.a * (0.65 + rnd() * 0.6),
      s: L.s * (0.7 + rnd() * 1.6),
      sp: L.sp * (0.6 + rnd() * 1.2),
    }))
  );
}

function WorldCanvas({ mode, state, computed, onClickVillage, onClickSky }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const pixelRef = useRef(null);
  const noiseRef = useRef(null);
  const pixelSizeRef = useRef(3);
  const rafRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const pointerRef = useRef({ x: 0.5, y: 0.5 });
  const fxRef = useRef([]);
  const fxIdRef = useRef(0);

  const spritesRef = useRef({ imgs: {}, ready: false });

  const stars = useMemo(() => makeStars(state.seed), [state.seed]);
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

  const addRipple = (x, y) => {
    const id = ++fxIdRef.current;
    fxRef.current.push({ id, kind: "ripple", x, y, t0: performance.now() });
  };
  const addFloat = (x, y, text) => {
    const id = ++fxIdRef.current;
    fxRef.current.push({
      id,
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
      const id = ++fxIdRef.current;
      fxRef.current.push({
        id,
        kind: "mote",
        x0: x0 + (Math.random() - 0.5) * 0.012,
        y0: y0 + (Math.random() - 0.5) * 0.012,
        x1: x1 + (Math.random() - 0.5) * 0.02,
        y1: y1 + (Math.random() - 0.5) * 0.02,
        t0: now + i * 16,
        dur: 520 + Math.random() * 260,
        glow: 0.6 + Math.random() * 0.7,
        hue, // "sky" | "village"
      });
    }
  };

  useEffect(() => {
    const handleResize = () => {
      const c = canvasRef.current;
      const root = wrapRef.current;
      if (!c || !root) return;
      const rect = root.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);
      sizeRef.current = { w, h, dpr };
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;

      // Allocate / sync offscreen buffers (scene + pixel buffer + noise).
      if (!sceneRef.current) sceneRef.current = document.createElement("canvas");
      if (!pixelRef.current) pixelRef.current = document.createElement("canvas");

      sceneRef.current.width = c.width;
      sceneRef.current.height = c.height;

      const px = pixelSizeRef.current || 3;
      pixelRef.current.width = Math.max(1, Math.floor(c.width / px));
      pixelRef.current.height = Math.max(1, Math.floor(c.height / px));

      if (!noiseRef.current) {
        const n = document.createElement("canvas");
        n.width = 64;
        n.height = 64;
        const nctx = n.getContext("2d");
        if (nctx) {
          const img = nctx.createImageData(n.width, n.height);
          for (let i = 0; i < img.data.length; i += 4) {
            const v = (Math.random() * 255) | 0;
            img.data[i] = v;
            img.data[i + 1] = v;
            img.data[i + 2] = v;
            img.data[i + 3] = 255;
          }
          nctx.putImageData(img, 0, 0);
        }
        noiseRef.current = n;
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);


// Load pixel-art sprites (real assets) used by the village scene.
useEffect(() => {
  let cancelled = false;
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
    if (cancelled) return;
    const imgs = {};
    for (const it of items) if (it.img) imgs[it.name] = it.img;
    spritesRef.current = { imgs, ready: true };
  });

  return () => {
    cancelled = true;
  };
}, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const displayCtx = c.getContext("2d");
    if (!displayCtx) return;

    // We draw the scene at full res into an offscreen canvas, then downsample + upscale
    // with smoothing disabled to get a crisp pixel-art look.
    if (!sceneRef.current) sceneRef.current = document.createElement("canvas");
    if (!pixelRef.current) pixelRef.current = document.createElement("canvas");

    const scene = sceneRef.current;
    const pixel = pixelRef.current;

    // keep in sync in case resize effect hasn't fired yet
    scene.width = c.width;
    scene.height = c.height;

    const ctx = scene.getContext("2d");
    const pixelCtx = pixel.getContext("2d");
    if (!ctx || !pixelCtx) return;

    const drawGlow = (x, y, r, col, a) => {
      ctx.save();
      ctx.globalAlpha = a;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, col);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawSky = (t) => {
      const { w, h, dpr } = sizeRef.current;
      const W = w * dpr;
      const H = h * dpr;
      const veil = computed.veil;

      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#04050b");
      bg.addColorStop(0.5, "#070a14");
      bg.addColorStop(1, "#030309");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // nebula
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const neb = ctx.createRadialGradient(
        W * 0.65,
        H * 0.45,
        0,
        W * 0.65,
        H * 0.45,
        Math.max(W, H) * 0.75
      );
      neb.addColorStop(0, "rgba(120,220,255,0.12)");
      neb.addColorStop(0.3, "rgba(160,120,255,0.06)");
      neb.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      const px = pointerRef.current.x - 0.5;
      const py = pointerRef.current.y - 0.5;
      const parX = state.settings.reducedMotion ? 0 : px * 18;
      const parY = state.settings.reducedMotion ? 0 : py * 10;

      // stars
      for (let li = 0; li < stars.length; li++) {
        const layer = stars[li];
        const mul = 0.6 + li * 0.35;
        for (const st of layer) {
          const tw = state.settings.reducedMotion
            ? 0.8
            : 0.65 + 0.35 * Math.sin(t * (0.9 + st.sp * 2) + st.tw);
          const a = st.a * tw * (1 - veil * 0.85);
          if (a < 0.02) continue;
          ctx.globalAlpha = a;
          ctx.fillStyle = "#eaf2ff";
          const x = (st.x * W + parX * mul + t * 6 * st.sp) % W;
          const y = (st.y * H + parY * mul) % H;
          ctx.fillRect(x, y, st.s * dpr, st.s * dpr);
        }
      }
      ctx.globalAlpha = 1;

      // constellation reveals with starsong
      const reveal = clamp((state.sky.starsong || 0) / 4, 0, 1);
      if (reveal > 0.02) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(200,230,255,0.85)";
        ctx.lineWidth = 1.2 * dpr;
        ctx.globalAlpha = 0.55 * reveal * (1 - veil * 0.65);

        for (let i = 0; i < constellation.length - 1; i++) {
          const a = constellation[i];
          const b = constellation[i + 1];
          ctx.beginPath();
          ctx.moveTo(a.x * W, a.y * H);
          ctx.lineTo(b.x * W, b.y * H);
          ctx.stroke();
        }

        for (const p of constellation) {
          drawGlow(p.x * W, p.y * H, 26 * dpr, "rgba(200,230,255,0.15)", 0.9);
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.globalAlpha = 0.95 * reveal * (1 - veil * 0.65);
          ctx.beginPath();
          ctx.arc(p.x * W, p.y * H, 2.2 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // veil overlay
      ctx.save();
      ctx.globalAlpha = 0.1 + 0.55 * veil;
      ctx.globalCompositeOperation = "overlay";
      const g2 = ctx.createRadialGradient(
        W * 0.35,
        H * 0.35,
        0,
        W * 0.35,
        H * 0.35,
        Math.max(W, H) * 0.85
      );
      g2.addColorStop(0, "rgba(255,255,255,0.18)");
      g2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      // vignette
      ctx.save();
      const vg = ctx.createRadialGradient(
        W * 0.5,
        H * 0.6,
        Math.min(W, H) * 0.1,
        W * 0.5,
        H * 0.6,
        Math.max(W, H) * 0.75
      );
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.75)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    };

    const drawVillage = (t) => {
      const { w, h, dpr } = sizeRef.current;
      const W = w * dpr;
      const H = h * dpr;

      drawSky(t);

      const groundY = H * 0.7;

      // mountains
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.58)";
      ctx.beginPath();
      ctx.moveTo(0, H * 0.62);
      ctx.lineTo(W * 0.12, H * 0.56);
      ctx.lineTo(W * 0.24, H * 0.6);
      ctx.lineTo(W * 0.36, H * 0.53);
      ctx.lineTo(W * 0.52, H * 0.61);
      ctx.lineTo(W * 0.7, H * 0.54);
      ctx.lineTo(W * 0.84, H * 0.6);
      ctx.lineTo(W, H * 0.55);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // ground gradient
      const grd = ctx.createLinearGradient(0, groundY, 0, H);
      grd.addColorStop(0, "rgba(0,0,0,0.0)");
      grd.addColorStop(0.15, "rgba(0,0,0,0.35)");
      grd.addColorStop(1, "rgba(0,0,0,0.80)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, groundY, W, H - groundY);

      // perspective grid
      ctx.save();
      ctx.globalAlpha = 0.07;
      ctx.strokeStyle = "rgba(160,220,255,0.55)";
      ctx.lineWidth = 1;
      const vanX = W * 0.52;
      const vanY = groundY - H * 0.08;
      for (let i = -10; i <= 10; i++) {
        ctx.beginPath();
        ctx.moveTo(vanX, vanY);
        ctx.lineTo(vanX + i * (W * 0.12), H);
        ctx.stroke();
      }
      for (let r = 0; r < 10; r++) {
        const y = groundY + r * r * (H * 0.003);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      ctx.restore();

      
const drawHouse = (x, y, w2, h2, lit) => {
  const spr = spritesRef.current?.imgs?.[lit ? "house" : "houseDark"];
  if (spr) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr, x - w2 / 2, y - h2, w2, h2);

    // warm window bloom so it doesn't look flat
    if (lit) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      drawGlow(x - w2 * 0.16, y - h2 * 0.55, 26 * dpr, "rgba(255,200,120,0.22)", 0.9);
      ctx.restore();
    }

    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(x, y);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        roundRectPath(ctx, -w2 / 2, -h2, w2, h2, 10);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.beginPath();
        ctx.moveTo(-w2 / 2 - 6, -h2 + 6);
        ctx.lineTo(0, -h2 - 14);
        ctx.lineTo(w2 / 2 + 6, -h2 + 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = lit
          ? "rgba(255,220,140,0.80)"
          : "rgba(255,255,255,0.18)";
        ctx.fillRect(-w2 * 0.18, -h2 * 0.55, w2 * 0.16, h2 * 0.18);

        if (lit) {
          const dpr = sizeRef.current.dpr;
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const gx = 0;
          const gy = -h2 * 0.45;
          const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 26 * dpr);
          g.addColorStop(0, "rgba(255,200,120,0.25)");
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(gx, gy, 26 * dpr, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        ctx.restore();
      };

      
const drawTemple = (x, y, scale) => {
  const spr = spritesRef.current?.imgs?.temple;
  if (spr) {
    const s = scale * dpr;
    const wT = 64 * s;
    const hT = 96 * s;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr, x - wT / 2, y - hT, wT, hT);

    // cool beam shimmer
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createLinearGradient(0, y - hT * 1.35, 0, y);
    g.addColorStop(0, "rgba(160,220,255,0.0)");
    g.addColorStop(0.50, "rgba(160,220,255,0.12)");
    g.addColorStop(1, "rgba(160,220,255,0.0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - wT * 0.14, y);
    ctx.lineTo(x - wT * 0.03, y - hT * 1.25);
    ctx.lineTo(x + wT * 0.03, y - hT * 1.25);
    ctx.lineTo(x + wT * 0.14, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.strokeStyle = "rgba(255,255,255,0.16)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        roundRectPath(ctx, -22, -92, 44, 92, 16);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-10, -92);
        ctx.lineTo(0, -120);
        ctx.lineTo(10, -92);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // beam
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.22;
        const g = ctx.createLinearGradient(0, -180, 0, -20);
        g.addColorStop(0, "rgba(160,220,255,0.0)");
        g.addColorStop(0.45, "rgba(160,220,255,0.18)");
        g.addColorStop(1, "rgba(160,220,255,0.0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-18, -20);
        ctx.lineTo(-6, -175);
        ctx.lineTo(6, -175);
        ctx.lineTo(18, -20);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.restore();
      };

      
const drawFollower = (x, y, s, glow) => {
  const spr = spritesRef.current?.imgs?.follower;
  if (spr) {
    const wF = 32 * s;
    const hF = 48 * s;
    if (glow > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      drawGlow(x, y - hF * 0.7, 18 * dpr * glow, "rgba(160,220,255,0.16)", 1);
      ctx.restore();
    }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr, x - wF / 2, y - hF, wF, hF);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
        if (glow > 0) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const g = ctx.createRadialGradient(0, -8, 0, 0, -8, 18);
          g.addColorStop(0, `rgba(160,220,255,${0.18 * glow})`);
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(0, -8, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.arc(0, -10, 3.2, 0, Math.PI * 2);
        ctx.fill();

        const g2 = ctx.createLinearGradient(0, -6, 0, 10);
        g2.addColorStop(0, "rgba(160,220,255,0.22)");
        g2.addColorStop(1, "rgba(255,255,255,0.04)");
        ctx.fillStyle = g2;
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        ctx.beginPath();
        roundRectPath(ctx, -6, -6, 12, 16, 8);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      };

      // buildings
      const huts = clamp(state.village.huts || 0, 0, 18);
      const farms = clamp(state.village.farms || 0, 0, 12);
      const temples = state.village.temples || 0;
      const festivals = state.village.festivals || 0;
      const council = state.village.council || 0;

      // starting hut
      drawHouse(W * 0.22, groundY + 22 * dpr, 90 * dpr, 70 * dpr, true);

      // huts cluster
      for (let i = 0; i < huts; i++) {
        const col = i % 6;
        const row = Math.floor(i / 6);
        const x = W * (0.33 + col * 0.07) + row * 10 * dpr;
        const y = groundY + (18 + row * 18) * dpr;
        const lit = state.devotion > 0 ? i % 3 !== 0 : i % 5 === 0;
        drawHouse(x, y, 62 * dpr, 48 * dpr, lit);
      }

      // farms
      for (let i = 0; i < farms; i++) {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = W * (0.18 + col * 0.17);
        const y = groundY + (92 + row * 18) * dpr;
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = "rgba(120,255,200,0.10)";
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        roundRectPath(ctx, -70 * dpr, -12 * dpr, 140 * dpr, 24 * dpr, 14 * dpr);
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = "rgba(120,255,200,0.55)";
        for (let k = -5; k <= 5; k++) {
          ctx.beginPath();
          ctx.moveTo(k * 12 * dpr, -10 * dpr);
          ctx.lineTo(k * 12 * dpr, 10 * dpr);
          ctx.stroke();
        }
        ctx.restore();
      }

      // council hall
      if (council > 0) {
        ctx.save();
        const x = W * 0.62;
        const y = groundY + 72 * dpr;
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        roundRectPath(
          ctx,
          x - 110 * dpr,
          y - 46 * dpr,
          220 * dpr,
          46 * dpr,
          18 * dpr
        );
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // temple
      if (temples > 0)
        drawTemple(
          W * 0.82,
          groundY + 30 * dpr,
          1.0 + Math.min(0.6, temples * 0.12)
        );

      // festival lantern glows
      if (festivals > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const n = Math.min(16, 4 + festivals * 3);
        for (let i = 0; i < n; i++) {
          const sx =
            W * (0.36 + (i / n) * 0.34) +
            Math.sin((state.settings.reducedMotion ? 0 : t) * 0.8 + i) *
              10 *
              dpr;
          const sy = groundY + (22 + (i % 4) * 8) * dpr;
          drawGlow(sx, sy, 34 * dpr, "rgba(255,160,220,0.18)", 0.9);
          drawGlow(
            sx + 6 * dpr,
            sy - 2 * dpr,
            28 * dpr,
            "rgba(160,220,255,0.16)",
            0.9
          );
          drawGlow(
            sx - 6 * dpr,
            sy + 2 * dpr,
            26 * dpr,
            "rgba(255,230,160,0.14)",
            0.9
          );
        }
        ctx.restore();
      }

      // followers
      const vis = clamp(Math.floor(state.followers), 0, 60);
      const baseGlow = state.unlocked.awakened ? 0.65 : 0;
      for (let i = 0; i < vis; i++) {
        const lane = i % 6;
        const phase = (i * 0.17) % 1;
        const walk = state.settings.reducedMotion
          ? phase
          : (phase + (t * 0.05 + lane * 0.01)) % 1;
        const x = W * (0.18 + walk * 0.64) + Math.sin(t * 0.8 + i) * (6 * dpr);
        const y =
          groundY +
          (46 + lane * 14) * dpr +
          Math.sin(t * 2.1 + i) * (1.4 * dpr);
        const s = 1.0 + lane * 0.06;
        drawFollower(x, y, s * dpr, baseGlow);
      }
    };

    const drawFx = (tMs) => {
      const { w, h, dpr } = sizeRef.current;
      const W = w * dpr;
      const H = h * dpr;

      fxRef.current = fxRef.current.filter((p) => {
        const age = tMs - p.t0;
        if (p.kind === "ripple") return age < 1100;
        if (p.kind === "float") return age < 900;
        if (p.kind === "mote") return age < p.dur + 120;
        return false;
      });

      const drawGlow2 = (x, y, r, col, a) => {
        ctx.save();
        ctx.globalAlpha = a;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, col);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };

      for (const p of fxRef.current) {
        if (p.kind === "ripple") {
          const age = (tMs - p.t0) / 1000;
          const x = p.x * W;
          const y = p.y * H;
          const r = (18 + age * 240) * dpr;
          ctx.save();
          ctx.globalAlpha = Math.max(0, 0.35 - age * 0.35);
          ctx.strokeStyle = "rgba(160,220,255,0.55)";
          ctx.lineWidth = 1.4 * dpr;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else if (p.kind === "float") {
          const age = (tMs - p.t0) / 1000;
          const x = p.x * W;
          const y = p.y * H;
          ctx.save();
          ctx.globalAlpha = Math.max(0, 0.95 - age * 1.1);
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          ctx.font = `${Math.floor(14 * dpr)}px ui-sans-serif, system-ui`;
          ctx.textAlign = "center";
          ctx.fillText(p.text, x, y - age * 70 * dpr);
          ctx.restore();
        } else if (p.kind === "mote") {
          const age = tMs - p.t0;
          if (age < 0) continue;
          const t = clamp(age / p.dur, 0, 1);
          const e = easeOutCubic(t);
          const x = (p.x0 + (p.x1 - p.x0) * e) * W;
          const y = (p.y0 + (p.y1 - p.y0) * e) * H;
          const trail = 10 + 22 * (1 - t);

          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = (1 - t) * 0.9;

          const col =
            p.hue === "sky"
              ? "rgba(180,220,255,0.35)"
              : "rgba(160,255,220,0.30)";
          drawGlow2(x, y, (12 + 10 * (1 - t)) * dpr, col, p.glow);

          ctx.strokeStyle =
            p.hue === "sky"
              ? "rgba(200,230,255,0.35)"
              : "rgba(160,255,220,0.25)";
          ctx.lineWidth = 1.2 * dpr;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - trail * dpr, y + trail * 0.35 * dpr);
          ctx.stroke();

          ctx.restore();
        }
      }
    };

    const loop = () => {
      const now = performance.now();
      const t = state.settings.reducedMotion ? 0 : now / 1000;

      // If reducedMotion flips, adjust pixel size to keep the aesthetic readable.
      const desiredPx = state.settings.reducedMotion ? 3 : 2;
      if (pixelSizeRef.current !== desiredPx) {
        pixelSizeRef.current = desiredPx;
        pixel.width = Math.max(1, Math.floor(c.width / desiredPx));
        pixel.height = Math.max(1, Math.floor(c.height / desiredPx));
      }

      // Ensure buffers match the visible canvas.
      if (scene.width !== c.width || scene.height !== c.height) {
        scene.width = c.width;
        scene.height = c.height;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, scene.width, scene.height);

      if (mode === "sky") drawSky(t);
      else drawVillage(t);

      // subtle film grain / dithering (becomes pixelated after the blit)
      if (noiseRef.current) {
        const W = scene.width;
        const H = scene.height;
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.globalCompositeOperation = "overlay";
        const shiftX = (now * 0.02) % noiseRef.current.width;
        const shiftY = (now * 0.015) % noiseRef.current.height;
        for (let x = -noiseRef.current.width; x < W + noiseRef.current.width; x += noiseRef.current.width) {
          for (let y = -noiseRef.current.height; y < H + noiseRef.current.height; y += noiseRef.current.height) {
            ctx.drawImage(noiseRef.current, x - shiftX, y - shiftY);
          }
        }
        ctx.restore();
      }

      drawFx(now);

      // Pixelate scene -> display.
      const W = c.width;
      const H = c.height;
      const PW = pixel.width;
      const PH = pixel.height;
      pixelCtx.imageSmoothingEnabled = false;
      displayCtx.imageSmoothingEnabled = false;
      pixelCtx.setTransform(1, 0, 0, 1, 0, 0);
      pixelCtx.clearRect(0, 0, PW, PH);
      pixelCtx.drawImage(scene, 0, 0, PW, PH);
      displayCtx.setTransform(1, 0, 0, 1, 0, 0);
      displayCtx.clearRect(0, 0, W, H);
      displayCtx.drawImage(pixel, 0, 0, PW, PH, 0, 0, W, H);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [mode, state, computed, stars, constellation]);

  const onPointerDown = (e) => {
    if (mode === "codex") return;
    const root = wrapRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    const y = clamp((e.clientY - rect.top) / Math.max(1, rect.height), 0, 1);

    addRipple(x, y);

    if (mode === "sky") {
      let best = constellation[0];
      let bestD = 999;
      for (const p of constellation) {
        const dx = p.x - x;
        const dy = p.y - y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      addMotesTo(x, y, best.x, best.y, "sky", 7);
      addFloat(x, y, "+Starlight");
      onClickSky();
    } else {
      const target =
        state.village.temples > 0 ? { x: 0.82, y: 0.7 } : { x: 0.42, y: 0.73 };
      addMotesTo(
        x,
        y,
        target.x,
        target.y,
        "village",
        state.unlocked.awakened ? 8 : 6
      );
      addFloat(x, y, state.unlocked.awakened ? "+Reverence" : "+Omen");
      onClickVillage();
    }
  };

  return (
    <div
      ref={wrapRef}
      className="world"
      onPointerMove={(e) => {
        const root = wrapRef.current;
        if (!root) return;
        const rect = root.getBoundingClientRect();
        pointerRef.current.x = clamp(
          (e.clientX - rect.left) / Math.max(1, rect.width),
          0,
          1
        );
        pointerRef.current.y = clamp(
          (e.clientY - rect.top) / Math.max(1, rect.height),
          0,
          1
        );
      }}
      onPointerDown={onPointerDown}
    >
      <canvas
        ref={canvasRef}
        className="worldCanvas"
        style={{ touchAction: "none" }}
      />
      <div className="worldVignette" />
    </div>
  );
}

export default WorldCanvas;
