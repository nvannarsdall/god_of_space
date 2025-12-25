import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Pill } from "../components/ui.jsx";
import {
  CONSTELLATIONS,
  getNodeById,
  isNodeRevealed,
  getRevealHint,
  canUnlockWithReason,
  unlockedSet,
} from "./constellations.js";
import { playSfx } from "../systems/audio.js";

/**
 * ConstellationTree (Step 3)
 * - A signature constellation-map UI: animated links, star nodes, and "wow" unlocks.
 * - Action-based reveal: nodes appear only after you perform related actions.
 * - Purchase with Starlight.
 *
 * Props:
 * - state
 * - onUnlock(nodeId) -> returns node object when purchase succeeds, else null
 */
export default function ConstellationTree({ state, onUnlock }) {
  const starlight = Number(state?.meta?.starlight || 0);
  const unlockedArr = state?.constellations?.unlocked || [];
  const unlocked = useMemo(() => unlockedSet(unlockedArr), [unlockedArr]);

  const [selected, setSelected] = useState(null);
  const [pulseUnlock, setPulseUnlock] = useState(null); // { id, t }
  const [pulseReveal, setPulseReveal] = useState(null); // { id, t }

  const prevRevealedRef = useRef(new Set());

  const byId = useMemo(() => {
    const m = new Map();
    (CONSTELLATIONS || []).forEach((n) => m.set(String(n.id), n));
    return m;
  }, []);

  const revealedSet = useMemo(() => {
    const s = new Set();
    (CONSTELLATIONS || []).forEach((n) => {
      if (isNodeRevealed(n, state)) s.add(String(n.id));
    });
    return s;
  }, [state]);

  // Detect newly revealed nodes for a subtle "a star appears" moment.
  useEffect(() => {
    const prev = prevRevealedRef.current;
    for (const id of revealedSet) {
      if (!prev.has(id)) {
        setPulseReveal({ id, t: Date.now() });
        playSfx("constellation_reveal");
        break;
      }
    }
    prevRevealedRef.current = new Set(revealedSet);
  }, [revealedSet]);

  const lines = useMemo(() => {
    const out = [];
    (CONSTELLATIONS || []).forEach((n) => {
      (n.links || []).forEach((toId) => {
        const to = byId.get(String(toId));
        if (!to) return;
        out.push({ from: n, to });
      });
    });
    return out;
  }, [byId]);

  const bgStars = useMemo(() => {
    const seed = (state?.seed || 999) >>> 0;
    let t = seed + 0x9e3779b9;
    const rnd = () => {
      t ^= t << 13;
      t ^= t >>> 17;
      t ^= t << 5;
      return (t >>> 0) / 4294967296;
    };
    const count = 120;
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: rnd() * 100,
        y: rnd() * 100,
        r: 1 + Math.floor(rnd() * 2),
        a: 0.18 + rnd() * 0.55,
        d: Math.floor(rnd() * 5000),
      });
    }
    return arr;
  }, [state?.seed]);

  const selectedNode = selected ? getNodeById(selected) : null;
  const selectedReason = selected ? canUnlockWithReason(selected, state) : null;

  const tryUnlock = (id) => {
    const node = byId.get(String(id));
    if (!node) return;
    const purchased = onUnlock?.(String(id));
    if (purchased) {
      setPulseUnlock({ id: String(id), t: Date.now() });
      playSfx("constellation_unlock");
    }
  };

  return (
    <Card
      title="Constellations"
      right={
        <Pill>
          ✦ {Math.floor(starlight)} Starlight
        </Pill>
      }
    >
      <div className="smallText" style={{ marginBottom: 10, opacity: 0.86 }}>
        Restore star-paths with <b>Starlight</b>. New stars appear when you perform
        the right actions — then you can purchase them.
      </div>

      <div
        className="constellationWrap"
        style={{
          position: "relative",
          width: "100%",
          height: 420,
          borderRadius: 14,
          overflow: "hidden",
          background:
            "radial-gradient(110% 70% at 50% 15%, rgba(120,170,255,0.12), rgba(0,0,0,0) 55%), linear-gradient(#070714, #05040a)",
          border: "1px solid rgba(120,150,220,0.16)",
        }}
        onMouseLeave={() => setSelected(null)}
      >
        {/* Background Stars */}
        <div className="constellationBG">
          {bgStars.map((s, i) => (
            <span
              key={i}
              className="twinkleStar"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: s.r,
                height: s.r,
                opacity: s.a,
                animationDelay: `${s.d}ms`,
              }}
            />
          ))}
        </div>

        {/* Links */}
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1000 600"
          style={{ position: "absolute", inset: 0 }}
        >
          {lines.map((L, i) => {
            const fromId = String(L.from.id);
            const toId = String(L.to.id);
            const fromOn = unlocked.has(fromId);
            const toOn = unlocked.has(toId);
            const both = fromOn && toOn;
            const visible = revealedSet.has(fromId) && revealedSet.has(toId);
            if (!visible) return null;

            const unlocking =
              pulseUnlock &&
              pulseUnlock.id === toId &&
              (L.to.req || []).some((r) => String(r) === fromId);

            return (
              <line
                key={i}
                x1={L.from.pos.x * 1000}
                y1={L.from.pos.y * 600}
                x2={L.to.pos.x * 1000}
                y2={L.to.pos.y * 600}
                className={`constellationLine ${both ? "on" : "off"} ${
                  unlocking ? "unlocking" : ""
                }`}
              />
            );
          })}

          {/* Unlock burst */}
          {pulseUnlock && (
            <g>
              <circle
                cx={(byId.get(pulseUnlock.id)?.pos?.x || 0) * 1000}
                cy={(byId.get(pulseUnlock.id)?.pos?.y || 0) * 600}
                r="0"
                className="constellationBurst"
              />
            </g>
          )}

          {/* Reveal pulse */}
          {pulseReveal && (
            <g>
              <circle
                cx={(byId.get(pulseReveal.id)?.pos?.x || 0) * 1000}
                cy={(byId.get(pulseReveal.id)?.pos?.y || 0) * 600}
                r="0"
                className="constellationReveal"
              />
            </g>
          )}
        </svg>

        {/* Nodes */}
        {(CONSTELLATIONS || []).map((n) => {
          const id = String(n.id);
          const revealed = revealedSet.has(id);
          if (!revealed) return null;
          const isUnlocked = unlocked.has(id);

          const sel = selected === id;
          const res = canUnlockWithReason(id, state);
          const canBuy = res?.ok;
          const lockReason = res?.reason;

          return (
            <div
              key={id}
              style={{
                position: "absolute",
                left: `${n.pos.x * 100}%`,
                top: `${n.pos.y * 100}%`,
                transform: "translate(-50%, -50%)",
                pointerEvents: "auto",
              }}
              onMouseEnter={() => setSelected(id)}
              onClick={() => setSelected(id)}
            >
              <div
                className={`starNode ${
                  isUnlocked ? "unlocked" : canBuy ? "can" : "locked"
                } ${sel ? "selected" : ""} ${
                  pulseReveal?.id === id ? "justRevealed" : ""
                }`}
                title={isUnlocked ? n.name : `${n.name} — ${n.cost} Starlight`}
              />

              {/* Tooltip card */}
              {sel && (
                <div className="starTooltip">
                  <div className="rowBetween" style={{ gap: 10 }}>
                    <div style={{ fontWeight: 900, letterSpacing: 0.3 }}>
                      {n.name}
                    </div>
                    <Pill>
                      {isUnlocked ? "Unlocked" : `${n.cost} Starlight`}
                    </Pill>
                  </div>
                  <div className="smallText" style={{ marginTop: 8, opacity: 0.9 }}>
                    {n.desc}
                  </div>

                  {!isUnlocked && (
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {lockReason === "hidden" && (
                        <div className="smallText" style={{ opacity: 0.8 }}>
                          Hint: <b>{getRevealHint(n)}</b>
                        </div>
                      )}
                      {lockReason === "req" && (
                        <div className="smallText" style={{ opacity: 0.8 }}>
                          Requires: {(n.req || []).map((rid) => byId.get(String(rid))?.name || rid).join(", ")}
                        </div>
                      )}
                      {lockReason === "cost" && (
                        <div className="smallText" style={{ opacity: 0.8 }}>
                          Need <b>{Math.max(0, n.cost - starlight)}</b> more Starlight.
                        </div>
                      )}

                      <Button
                        variant={canBuy ? "primary" : "secondary"}
                        disabled={!canBuy}
                        onClick={() => tryUnlock(id)}
                      >
                        Restore Star
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
