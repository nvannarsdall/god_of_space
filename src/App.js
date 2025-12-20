import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * God of Space — Single-file, preview-friendly incremental game.
 * - No external deps
 * - No TypeScript
 * - Canvas world + modern UI overlay
 */

const LS_KEY = "space_god_incremental_v6_preview";

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function fmt(n) {
  if (!Number.isFinite(n)) return "∞";
  if (n < 1000) return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0);
  const units = ["K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
  let u = -1;
  let v = n;
  while (v >= 1000 && u < units.length - 1) {
    v /= 1000;
    u++;
  }
  return `${v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0)}${units[u]}`;
}

function deepMerge(base, incoming) {
  const out = JSON.parse(JSON.stringify(base));
  const merge = (a, b) => {
    Object.keys(b || {}).forEach((k) => {
      if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k])) {
        a[k] = a[k] || {};
        merge(a[k], b[k]);
      } else {
        a[k] = b[k];
      }
    });
  };
  merge(out, incoming || {});
  return out;
}

function baseState() {
  return {
    t: 0,
    seed: Math.floor(Math.random() * 1e9),

    followers: 0,
    devotion: 0, // Reverence
    power: 0, // Authority

    whispers: 0, // Omens (pre-awakening)
    stardust: 0, // Starlight bucket

    village: { huts: 0, farms: 0, temples: 0, festivals: 0, council: 0 },
    sky: { starsong: 0, orbits: 0, telescope: 0, transcend: 0, crown: 0 },

    unlocked: { awakened: false, convert: false, sky: false },
    ui: {
      tutorialHidden: false,
      tab: "village",
      screen: "menu",
      tutorialStep: 0,
      tutorialActive: true,
    },

    settings: {
      autosave: true,
      reducedMotion: false,
      musicEnabled: false,
      musicVolume: 0.65,
    },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(s) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

function migrateState(s) {
  const next = JSON.parse(JSON.stringify(s));

  // critical bug fix: if you have followers, you're awakened
  if (next.followers >= 1) next.unlocked.awakened = true;

  // unlock convert once temples exist
  if ((next.village?.temples || 0) >= 1) next.unlocked.convert = true;

  // unlock sky once you have authority or sky upgrades
  if (next.power > 0 || (next.sky?.starsong || 0) > 0) next.unlocked.sky = true;

  // sanity
  next.followers = Math.max(0, next.followers);
  next.devotion = Math.max(0, next.devotion);
  next.power = Math.max(0, next.power);
  next.whispers = Math.max(0, next.whispers);
  next.stardust = Math.max(0, next.stardust);

  next.village = Object.assign(
    { huts: 0, farms: 0, temples: 0, festivals: 0, council: 0 },
    next.village || {}
  );
  next.sky = Object.assign(
    { starsong: 0, orbits: 0, telescope: 0, transcend: 0, crown: 0 },
    next.sky || {}
  );
  next.unlocked = Object.assign(
    { awakened: false, convert: false, sky: false },
    next.unlocked || {}
  );
  next.ui = Object.assign(
    {
      tutorialHidden: false,
      tab: "village",
      screen: "menu",
      tutorialStep: 0,
      tutorialActive: true,
    },
    next.ui || {}
  );
  next.settings = Object.assign(
    {
      autosave: true,
      reducedMotion: false,
      musicEnabled: false,
      musicVolume: 0.65,
    },
    next.settings || {}
  );

  return next;
}

function upgradeCost(base, growth, lvl) {
  return base * Math.pow(growth, lvl);
}

const VILLAGE_UPGRADES = [
  {
    id: "huts",
    name: "Huts",
    desc: "Shelter stabilizes the settlement. Enables passive follower growth.",
    baseCost: 25,
    growth: 1.17,
    currency: "devotion",
    effect: (lvl) => `Growth potential +${(0.07 * (lvl + 1)).toFixed(2)}/s`,
  },
  {
    id: "farms",
    name: "Farms",
    desc: "Food surplus: faster growth and higher reverence yield.",
    baseCost: 85,
    growth: 1.19,
    currency: "devotion",
    effect: (lvl) =>
      `Growth +${(0.11 * (lvl + 1)).toFixed(2)}/s, Reverence +${Math.round(
        (lvl + 1) * 2
      )}%`,
  },
  {
    id: "temples",
    name: "Temples",
    desc: "Ritual focus: reverence deepens. Unlocks conversion.",
    baseCost: 260,
    growth: 1.22,
    currency: "devotion",
    effect: (lvl) => `Reverence +${Math.round((lvl + 1) * 8)}%, unlock Convert`,
  },
  {
    id: "festivals",
    name: "Festivals",
    desc: "Rapture spreads: bigger click bursts and devotion surges.",
    baseCost: 620,
    growth: 1.23,
    currency: "devotion",
    effect: (lvl) =>
      `Click +${Math.round((lvl + 1) * 6)}%, surges +${Math.round(
        (lvl + 1) * 3
      )}%`,
  },
  {
    id: "council",
    name: "Council",
    desc: "Order in the dark: increases follower cap significantly.",
    baseCost: 1200,
    growth: 1.26,
    currency: "devotion",
    effect: (lvl) => `Cap +${Math.round((lvl + 1) * 25)}`,
  },
];

const SKY_UPGRADES = [
  {
    id: "starsong",
    name: "Starsong",
    desc: "Peel back the Veil: constellations become real.",
    baseCost: 40,
    growth: 1.22,
    currency: "power",
    effect: (lvl) => `Veil -${Math.round((lvl + 1) * 9)}%`,
  },
  {
    id: "orbits",
    name: "Orbits",
    desc: "Mechanize the heavens: boosts conversion.",
    baseCost: 125,
    growth: 1.24,
    currency: "power",
    effect: (lvl) => `Convert +${Math.round((lvl + 1) * 7)}%`,
  },
  {
    id: "telescope",
    name: "Telescope",
    desc: "Sky clicks yield more starlight.",
    baseCost: 230,
    growth: 1.25,
    currency: "power",
    effect: (lvl) => `Sky click +${Math.round((lvl + 1) * 12)}%`,
  },
  {
    id: "transcend",
    name: "Transcend",
    desc: "The void yields: raises caps and stabilizes growth.",
    baseCost: 520,
    growth: 1.27,
    currency: "power",
    effect: (lvl) => `Cap +${Math.round((lvl + 1) * 8)}%`,
  },
  {
    id: "crown",
    name: "Crown of Night",
    desc: "Rule the dusk: increases global output.",
    baseCost: 1100,
    growth: 1.29,
    currency: "power",
    effect: (lvl) => `All +${Math.round((lvl + 1) * 5)}%`,
  },
];

function compute(s) {
  const huts = s.village.huts || 0;
  const farms = s.village.farms || 0;
  const temples = s.village.temples || 0;
  const festivals = s.village.festivals || 0;
  const council = s.village.council || 0;

  const starsong = s.sky.starsong || 0;
  const orbits = s.sky.orbits || 0;
  const telescope = s.sky.telescope || 0;
  const transcend = s.sky.transcend || 0;
  const crown = s.sky.crown || 0;

  let cap = 12 + huts * 6 + council * 25;
  cap *= 1 + transcend * 0.08;

  // follower growth: only after awakened AND huts>=1
  const growthAdd = huts >= 1 ? 0.07 + huts * 0.07 + farms * 0.11 : 0;
  const pressure = cap <= 0 ? 1 : clamp(1 - s.followers / cap, 0, 1);
  const followerRate =
    s.unlocked.awakened && huts >= 1 ? growthAdd * (0.2 + 0.8 * pressure) : 0;

  // devotion/reverence per follower
  let devotionPerFollower = 0.55;
  devotionPerFollower *= 1 + farms * 0.02;
  devotionPerFollower *= 1 + temples * 0.08;
  devotionPerFollower *= 1 + crown * 0.05;

  const surgeChance = clamp(festivals * 0.03, 0, 0.45);
  const surgeMult = 1 + festivals * 0.1;
  const surgeEV = 1 + surgeChance * (surgeMult - 1);

  const globalMul = 1 + crown * 0.05;
  const devotionRate = s.unlocked.awakened
    ? s.followers * devotionPerFollower * surgeEV * globalMul
    : 0;

  let convertEff = 0.02;
  convertEff *= 1 + temples * 0.02;
  convertEff *= 1 + orbits * 0.07;

  const veil = clamp(1 - starsong * 0.09, 0.08, 1);
  const telescopeBonus = 1 + telescope * 0.12;

  const clickDevotionBonus = 0.35 + temples * 0.03 + festivals * 0.01;
  const clickFestivalMul = 1 + festivals * 0.06;

  return {
    cap,
    followerRate,
    devotionRate,
    convertEff,
    veil,
    telescopeBonus,
    clickDevotionBonus,
    clickFestivalMul,
    globalMul,
  };
}

/* ---------------- Canvas world ---------------- */

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
  const rafRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const pointerRef = useRef({ x: 0.5, y: 0.5 });
  const fxRef = useRef([]);
  const fxIdRef = useRef(0);

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
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

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

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);

      if (mode === "sky") drawSky(t);
      else drawVillage(t);

      drawFx(now);

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

/* ---------------- UI helpers ---------------- */

function Pill({ children }) {
  return <span className="pill">{children}</span>;
}

function Button({ children, onClick, disabled, variant = "primary", title }) {
  const cls =
    variant === "danger"
      ? "btn btnDanger"
      : variant === "ghost"
      ? "btn btnGhost"
      : variant === "secondary"
      ? "btn btnSecondary"
      : "btn btnPrimary";
  return (
    <button className={cls} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

function Card({ title, right, children }) {
  return (
    <div className="card">
      {(title || right) && (
        <div className="cardHeader">
          <div className="cardTitle">{title}</div>
          <div className="cardRight">{right}</div>
        </div>
      )}
      <div className="cardBody">{children}</div>
    </div>
  );
}

function Progress({ value }) {
  const v = clamp(value, 0, 100);
  return (
    <div className="prog">
      <div className="progFill" style={{ width: `${v}%` }} />
    </div>
  );
}

/* ---------------- Tutorial spotlight overlay ---------------- */

function TutorialOverlay({
  rect,
  title,
  body,
  onNext,
  nextLabel = "Next",
  showNext = true,
}) {
  const pad = 10;
  const r = rect
    ? {
        x: Math.max(0, rect.left - pad),
        y: Math.max(0, rect.top - pad),
        w: Math.max(0, rect.width + pad * 2),
        h: Math.max(0, rect.height + pad * 2),
      }
    : null;

  return (
    <div className="tutOverlay">
      <svg className="tutSvg" width="100%" height="100%">
        <defs>
          <mask id="holeMask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {r && (
              <rect
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                rx="18"
                ry="18"
                fill="black"
              />
            )}
          </mask>
        </defs>

        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.72)"
          mask="url(#holeMask)"
        />

        {r && (
          <rect
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx="18"
            ry="18"
            fill="transparent"
            stroke="rgba(160,220,255,0.55)"
            strokeWidth="2"
          />
        )}
      </svg>

      <div className="tutPanel">
        <div className="tutTitle">{title}</div>
        <div className="tutBody">{body}</div>
        {showNext && (
          <div
            style={{
              marginTop: 10,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button className="btn btnPrimary" onClick={onNext}>
              {nextLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Main App ---------------- */

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
  const omensRef = useRef(null);
  const seekerBtnRef = useRef(null);
  const upgradesRef = useRef(null);
  const convertBtnRef = useRef(null);
  const skyTabRef = useRef(null);

  const tab = state.ui.tab;
  const awakened = state.unlocked.awakened;

  const tutorialOn = Boolean(
    state.ui?.tutorialActive && state.ui?.screen === "tutorial"
  );
  const tutStep = state.ui?.tutorialStep || 0;

  const allowVillageList = !tutorialOn || tutStep >= 2;
  const allowConvert = !tutorialOn || tutStep >= 4;
  const allowSkyTab = !tutorialOn || tutStep >= 5;
  const inMenu = state.ui?.screen === "menu";

  const leftHudPE = tutorialOn
    ? tutStep === 1 || tutStep === 4
      ? "auto"
      : "none"
    : "auto";
  const rightPanelPE = tutorialOn
    ? tutStep === 2 || tutStep === 3 || tutStep === 5
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
      } catch {}
      return;
    }
    const idx = clamp(track, 0, playlist.length - 1);
    const url = playlist[idx]?.url;
    if (url && el.src !== url) {
      el.src = url;
      try {
        el.load();
      } catch {}
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

  const seekerCost = 20;
  const canCallSeeker = !awakened && state.whispers >= seekerCost;

  const callSeeker = () => {
    setState((s0) => {
      const s = migrateState(s0);
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

  const convert = () => {
    setState((s0) => {
      const s = migrateState(s0);

      const tut = Boolean(s.ui?.tutorialActive && s.ui?.screen === "tutorial");
      const step = s.ui?.tutorialStep || 0;
      if (tut && step < 4) return s;

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
      } else {
        if (s.power < cost) return s;
        const next = {
          ...s,
          power: s.power - cost,
          sky: { ...s.sky, [u.id]: lvl + 1 },
        };
        return migrateState(next);
      }
    });
  };

  const setTab = (t) => {
    setState((s) => ({ ...s, ui: { ...s.ui, tab: t } }));
  };

  // tutorial logic (unstickable)
  const tutorial = useMemo(() => {
    const steps = [
      {
        id: "click",
        title: "Click the world",
        body: "Click anywhere. Before you awaken, clicks produce Omens.",
        done: () => state.whispers >= 6,
      },
      {
        id: "seeker",
        title: "Call a Seeker",
        body: `Spend ${seekerCost} Omens to invite your first follower.`,
        done: () => state.unlocked.awakened,
      },
      {
        id: "huts",
        title: "Build Huts",
        body: "Buy 1 Hut to enable passive follower growth.",
        done: () => (state.village.huts || 0) >= 1,
      },
      {
        id: "temple",
        title: "Unlock Conversion",
        body: "Buy 1 Temple to unlock converting Reverence into Authority.",
        done: () => state.unlocked.convert,
      },
      {
        id: "sky",
        title: "Open the Sky",
        body: "Once you have Authority, click the sky and buy Starsong to lower the Veil.",
        done: () => state.unlocked.sky && (state.sky.starsong || 0) >= 1,
      },
    ];
    const next = steps.find((s) => !s.done());
    if (!next) return null;
    return { ...next, idx: steps.indexOf(next), total: steps.length };
  }, [state, seekerCost]);

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
    } catch {}
    showToast("Reset complete.");
  };

  // spotlight tutorial model (focuses one portion of the screen at a time)
  const getRect = (ref) => {
    const el = ref?.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  };

  const tutData = useMemo(() => {
    if (!tutorialOn) return null;

    const steps = [
      {
        title: "Click the world",
        body: "Click anywhere on the world to gather Omens. We'll use them to call your first follower.",
        target: () => getRect(worldRef),
        done: () => state.whispers >= 6,
      },
      {
        title: "Call a Seeker",
        body: `Spend ${seekerCost} Omens to invite your first follower. After this, Reverence begins.`,
        target: () => getRect(seekerBtnRef),
        done: () => state.unlocked.awakened,
      },
      {
        title: "Build a Hut",
        body: "Buy 1 Hut. Huts unlock passive follower growth so progress continues without constant clicking.",
        target: () => getRect(upgradesRef),
        done: () => (state.village.huts || 0) >= 1,
      },
      {
        title: "Build a Temple",
        body: "Buy 1 Temple to unlock conversion. This is how Reverence becomes Authority.",
        target: () => getRect(upgradesRef),
        done: () => (state.village.temples || 0) >= 1,
      },
      {
        title: "Convert Reverence → Authority",
        body: "Convert some Reverence into Authority. Authority is used to restore the sky.",
        target: () => getRect(convertBtnRef),
        done: () => state.power > 0,
      },
      {
        title: "Open the Sky",
        body: "The Sky tab is now available. Clicking the sky yields Starlight, and Starsong lowers the Veil.",
        target: () => getRect(skyTabRef),
        done: () => state.unlocked.sky,
      },
    ];

    const idx = clamp(tutStep, 0, steps.length - 1);
    const cur = steps[idx];
    return { ...cur, idx, total: steps.length };
  }, [tutorialOn, tutStep, state, seekerCost]);

  const advanceTutorial = () => {
    setState((s0) => {
      const s = migrateState(s0);
      const step = s.ui?.tutorialStep || 0;
      const nextStep = step + 1;
      if (nextStep >= 6) {
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
    (state.devotion || 0) > 0 ||
    (state.power || 0) > 0 ||
    (state.village?.huts || 0) > 0 ||
    (state.sky?.starsong || 0) > 0;

  return (
    <div className="appRoot">
      <style>{CSS}</style>

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

          {/* ✅ FIXED OMENS BLOCK */}
          <div className="statBox" ref={omensRef}>
            <div className="rowBetween">
              <div className="statLabel">Omens</div>
              <div className="statValueSmall">{fmt(state.whispers)}</div>
            </div>

            <div className="statSub">Earned by clicking before you awaken.</div>

            {!awakened && (
              <>
                <Progress value={(state.whispers / seekerCost) * 100} />

                <div className="statSub">
                  Seeker cost: {seekerCost} (
                  {Math.max(0, seekerCost - state.whispers)} more)
                </div>

                <div ref={seekerBtnRef} style={{ marginTop: 8 }}>
                  <Button onClick={callSeeker} disabled={!canCallSeeker}>
                    Call a Seeker ({seekerCost})
                  </Button>
                </div>
              </>
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
            <div ref={convertBtnRef} style={{ marginTop: 8 }}>
              <Button
                variant="secondary"
                onClick={convert}
                disabled={
                  !allowConvert ||
                  !state.unlocked.convert ||
                  state.devotion < 10
                }
                title={
                  !allowConvert
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
                  } catch {}
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
            tutorial && !state.ui.tutorialHidden ? (
              <Pill>
                Tutorial {tutorial.idx + 1}/{tutorial.total}
              </Pill>
            ) : (
              <Pill>Freeplay</Pill>
            )
          }
        >
          <div className="tabs">
            <button
              className={`tab ${tab === "village" ? "tabActive" : ""}`}
              onClick={() => setTab("village")}
            >
              Village
            </button>
            <button
              ref={skyTabRef}
              className={`tab ${tab === "sky" ? "tabActive" : ""} ${
                !allowSkyTab || !state.unlocked.sky ? "tabDisabled" : ""
              }`}
              onClick={() => allowSkyTab && state.unlocked.sky && setTab("sky")}
              title={
                !allowSkyTab
                  ? "Tutorial: the Sky comes later"
                  : state.unlocked.sky
                  ? ""
                  : "Unlock by gaining Authority"
              }
            >
              Sky
            </button>
            <button
              className={`tab ${tab === "codex" ? "tabActive" : ""}`}
              onClick={() => setTab("codex")}
            >
              Codex
            </button>
          </div>

          {/* ✅ FIXED VILLAGE BLOCK */}
          {tab === "village" && (
            <>
              <div className="smallText">
                Click the world for <b>{awakened ? "Reverence" : "Omens"}</b>.
                Buy upgrades with Reverence.
              </div>

              {!allowVillageList ? (
                <div className="tinyMuted" style={{ marginTop: 10 }}>
                  Tutorial: awaken first — then we’ll build a Hut.
                </div>
              ) : (
                <div className="list" ref={upgradesRef}>
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

          {/* ✅ FIXED SKY BLOCK */}
          {tab === "sky" && (
            <>
              {!allowSkyTab ? (
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
                  <div className="list">
                    {SKY_UPGRADES.filter((u) => {
                      if (!tutorialOn) return true;
                      if (tutStep === 5) return u.id === "starsong";
                      return true;
                    }).map((u) => {
                      const lvl = state.sky[u.id] || 0;
                      const cost = upgradeCost(u.baseCost, u.growth, lvl);
                      const can = state.power >= cost;

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

          {tab === "codex" && (
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

          {/* Tutorial helper */}
          {!tutorialOn && tutorial && !state.ui.tutorialHidden && (
            <div className="tutorialCard">
              <div className="rowBetween">
                <div>
                  <div className="tutorialTitle">{tutorial.title}</div>
                  <div className="tutorialBody">{tutorial.body}</div>
                </div>
                <Pill>
                  {tutorial.idx + 1}/{tutorial.total}
                </Pill>
              </div>

              <div className="rowBetween" style={{ marginTop: 10, gap: 10 }}>
                <div className="tinyMuted">
                  {tutorial.id === "click"
                    ? `Progress: ${fmt(state.whispers)}/6 Omens`
                    : tutorial.id === "seeker"
                    ? `Need: ${Math.max(0, seekerCost - state.whispers)} Omens`
                    : tutorial.id === "huts"
                    ? (state.village.huts || 0) >= 1
                      ? "Done"
                      : "Buy 1 Hut"
                    : tutorial.id === "temple"
                    ? (state.village.temples || 0) >= 1
                      ? "Done"
                      : "Buy 1 Temple"
                    : "Buy Starsong once Sky is open"}
                </div>

                {tutorial.id === "seeker" ? (
                  <Button onClick={callSeeker} disabled={!canCallSeeker}>
                    Call Seeker
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setState((s) => ({
                        ...s,
                        ui: { ...s.ui, tutorialHidden: true },
                      }))
                    }
                  >
                    Hide tutorial
                  </Button>
                )}
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
      {tutorialOn && tutData && (
        <TutorialOverlay
          rect={tutData.target?.()}
          title={`${tutData.title} (${tutData.idx + 1}/${tutData.total})`}
          body={tutData.body}
          showNext={tutData.done?.()}
          nextLabel={tutData.idx + 1 >= tutData.total ? "Finish" : "Next"}
          onNext={advanceTutorial}
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

/* ---------------- CSS ---------------- */

const CSS = `
:root{
  --bg: #000;
  --glass: rgba(0,0,0,0.45);
  --glass2: rgba(255,255,255,0.06);
  --border: rgba(255,255,255,0.10);
  --border2: rgba(255,255,255,0.14);
  --text: rgba(255,255,255,0.92);
  --muted: rgba(255,255,255,0.60);
  --muted2: rgba(255,255,255,0.45);
  --shadow: 0 12px 40px rgba(0,0,0,0.45);
  --r: 18px;
  --r2: 16px;
}

*{ box-sizing: border-box; }
html,body{ height:100%; margin:0; background:var(--bg); color:var(--text); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; }
.appRoot{ min-height:100vh; overflow:hidden; }

.world{ position:fixed; inset:0; z-index:0; }
.worldCanvas{ width:100%; height:100%; display:block; }
.worldVignette{
  pointer-events:none;
  position:absolute; inset:0;
  background: radial-gradient(circle at 50% 30%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.80) 100%);
}

.topBar{
  position:fixed; top:0; left:0; right:0; z-index:30;
  padding:14px 16px;
}
.topBarInner{
  margin:0 auto; max-width:1200px;
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  padding:12px 14px;
  border-radius: 22px;
  border:1px solid var(--border);
  background: var(--glass);
  backdrop-filter: blur(14px);
  box-shadow: var(--shadow);
}
.brand{ display:flex; align-items:center; gap:12px; }
.brandMark{
  width:40px; height:40px; display:grid; place-items:center;
  border-radius: 16px;
  border:1px solid var(--border);
  background: var(--glass2);
  font-size: 18px;
}
.brandTitle{ font-weight: 700; font-size: 13px; letter-spacing: 0.2px; }
.brandSub{ font-size: 11px; color: var(--muted); margin-top: 1px; }
.topActions{ display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }

.leftHud{
  position:fixed; left:16px; top:92px; z-index:30;
  width:320px; max-width: calc(100vw - 32px);
  max-height: calc(100vh - 120px);
  overflow:auto;
  padding-bottom: 12px;
}
.rightPanel{
  position:fixed; right:16px; top:92px; z-index:30;
  width:420px; max-width: calc(100vw - 32px);
  max-height: calc(100vh - 120px);
  overflow:auto;
  padding-bottom: 12px;
}

.card{
  border-radius: 22px;
  border:1px solid var(--border);
  background: var(--glass);
  backdrop-filter: blur(14px);
  box-shadow: var(--shadow);
  overflow:hidden;
}
.cardHeader{
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  padding:14px 14px 8px 14px;
}
.cardTitle{ font-weight: 700; font-size: 14px; }
.cardBody{ padding: 0 14px 14px 14px; }

.pill{
  display:inline-flex; align-items:center; gap:6px;
  border-radius: 999px;
  border:1px solid var(--border);
  background: rgba(255,255,255,0.06);
  padding: 6px 10px;
  font-size: 11px;
  color: rgba(255,255,255,0.88);
}

.btn{
  border:1px solid var(--border);
  background: rgba(255,255,255,0.08);
  color: var(--text);
  border-radius: 14px;
  padding: 9px 12px;
  font-size: 12px;
  cursor:pointer;
  transition: transform .06s ease, background .15s ease, border .15s ease;
  user-select:none;
}
.btn:hover{ background: rgba(255,255,255,0.12); border-color: var(--border2); }
.btn:active{ transform: translateY(1px); }
.btn:disabled{ opacity:0.55; cursor:not-allowed; }
.btnPrimary{ background: rgba(160,220,255,0.14); border-color: rgba(160,220,255,0.22); }
.btnPrimary:hover{ background: rgba(160,220,255,0.20); border-color: rgba(160,220,255,0.30); }
.btnSecondary{ background: rgba(255,255,255,0.08); }
.btnDanger{ background: rgba(255,70,90,0.14); border-color: rgba(255,70,90,0.22); }
.btnDanger:hover{ background: rgba(255,70,90,0.20); border-color: rgba(255,70,90,0.30); }
.btnGhost{ background: transparent; }

.grid2{ display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom: 10px; }
.statBox{
  border-radius: 18px;
  border:1px solid var(--border);
  background: rgba(0,0,0,0.25);
  padding: 12px;
}
.statLabel{ font-size: 11px; color: var(--muted); }
.statValue{ font-size: 18px; font-weight: 800; margin-top: 4px; }
.statValueSmall{ font-size: 14px; font-weight: 800; }
.statSub{ font-size: 11px; color: var(--muted2); margin-top: 6px; }
.rowBetween{ display:flex; align-items:center; justify-content:space-between; }

.prog{
  height:10px;
  border-radius: 999px;
  border:1px solid var(--border);
  background: rgba(255,255,255,0.06);
  overflow:hidden;
  margin-top: 8px;
}
.progFill{
  height:100%;
  background: linear-gradient(90deg, rgba(160,220,255,0.55), rgba(255,160,220,0.45));
  border-radius: 999px;
}

.tabs{
  display:grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap:8px;
  background: rgba(255,255,255,0.04);
  border:1px solid var(--border);
  border-radius: 18px;
  padding: 8px;
  margin-bottom: 10px;
}
.tab{
  border:1px solid transparent;
  border-radius: 14px;
  background: transparent;
  color: rgba(255,255,255,0.80);
  padding: 10px 10px;
  cursor:pointer;
  font-size: 12px;
}
.tab:hover{ background: rgba(255,255,255,0.06); }
.tabActive{
  background: rgba(160,220,255,0.12);
  border-color: rgba(160,220,255,0.20);
  color: rgba(255,255,255,0.92);
}
.tabDisabled{ opacity:0.45; cursor:not-allowed; }

.smallText{ font-size: 12px; color: rgba(255,255,255,0.72); line-height: 1.35; }
.tinyMuted{ font-size: 11px; color: rgba(255,255,255,0.48); margin-top: 8px; }

.list{ display:flex; flex-direction:column; gap:10px; margin-top: 10px; }
.item{
  border-radius: 18px;
  border:1px solid var(--border);
  background: rgba(0,0,0,0.22);
  padding: 12px;
}
.itemTop{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.itemName{ font-weight: 800; font-size: 13px; }
.itemDesc{ margin-top: 6px; font-size: 12px; color: rgba(255,255,255,0.68); line-height: 1.35; }
.itemEffect{ margin-top: 8px; font-size: 11px; color: rgba(255,255,255,0.52); }

.codex{ padding-top: 6px; }
.codexTitle{ font-weight: 900; font-size: 14px; margin-bottom: 8px; }
.codex p{ margin: 0 0 10px 0; color: rgba(255,255,255,0.78); font-size: 13px; line-height: 1.5; }
.codexBox{
  border-radius: 18px;
  border:1px solid var(--border);
  background: rgba(255,255,255,0.04);
  padding: 12px;
}
.codexBoxTitle{ font-weight: 800; margin-bottom: 6px; font-size: 12px; }
.codexBox ul{ margin:0; padding-left: 18px; color: rgba(255,255,255,0.70); font-size: 12px; line-height: 1.45; }

.tutorialCard{
  margin-top: 12px;
  border-radius: 18px;
  border:1px solid var(--border);
  background: rgba(0,0,0,0.38);
  padding: 12px;
}
.tutorialTitle{ font-weight: 900; font-size: 13px; }
.tutorialBody{ margin-top: 6px; font-size: 12px; color: rgba(255,255,255,0.70); line-height: 1.35; }

.toast{
  position:fixed;
  left:50%;
  bottom: 18px;
  transform: translateX(-50%);
  z-index: 60;
  padding: 12px 14px;
  border-radius: 18px;
  border:1px solid var(--border);
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(14px);
  box-shadow: var(--shadow);
  color: rgba(255,255,255,0.92);
  font-size: 13px;
}

.fileInput{
  width: 100%;
  margin-top: 6px;
  color: rgba(255,255,255,0.70);
  font-size: 12px;
}

/* Spotlight tutorial */
.tutOverlay{
  position:fixed; inset:0; z-index:80;
  pointer-events:none;
}
.tutSvg{ position:absolute; inset:0; width:100%; height:100%; }
.tutPanel{
  position:fixed; left:50%; bottom:22px; transform: translateX(-50%);
  width: min(520px, calc(100vw - 32px));
  border-radius: 22px;
  border:1px solid var(--border);
  background: rgba(0,0,0,0.72);
  backdrop-filter: blur(14px);
  box-shadow: var(--shadow);
  padding: 14px;
  pointer-events:auto;
}
.tutTitle{ font-weight: 900; font-size: 13px; }
.tutBody{ margin-top: 6px; font-size: 12px; color: rgba(255,255,255,0.72); line-height: 1.45; }

/* Main menu */
.menuOverlay{
  position:fixed; inset:0; z-index:90;
  display:grid; place-items:center;
  background: rgba(0,0,0,0.60);
  backdrop-filter: blur(10px);
}
.menuCard{
  width: min(560px, calc(100vw - 32px));
  border-radius: 26px;
  border:1px solid var(--border);
  background: rgba(0,0,0,0.70);
  box-shadow: var(--shadow);
  padding: 18px;
}
.menuTitle{ font-weight: 900; font-size: 18px; letter-spacing: 0.4px; }
.menuSub{ margin-top: 6px; color: rgba(255,255,255,0.70); font-size: 13px; line-height: 1.45; }
.menuButtons{ margin-top: 14px; display:flex; gap:10px; flex-wrap:wrap; }
.menuHint{ margin-top: 12px; color: rgba(255,255,255,0.55); font-size: 12px; line-height: 1.4; }
`;
