import React, { useMemo } from "react";
import { Button, Card, Pill } from "../components/ui";
import { CONSTELLATIONS, canUnlock } from "./constellations";

/**
 * ConstellationTree (Phase 3)
 * - Renders a star-map style skill tree
 * - Spend constellation points to unlock nodes
 * - Dependencies enforce branching choices
 */
export default function ConstellationTree({ state, onUnlock }) {
  const points = state?.constellations?.points || 0;
  const unlocked = state?.constellations?.unlocked || [];

  const byId = useMemo(() => {
    const m = new Map();
    CONSTELLATIONS.forEach((n) => m.set(n.id, n));
    return m;
  }, []);

  const unlockedSet = useMemo(() => new Set(unlocked), [unlocked]);

  const lines = useMemo(() => {
    const out = [];
    CONSTELLATIONS.forEach((n) => {
      (n.links || []).forEach((toId) => {
        const to = byId.get(toId);
        if (!to) return;
        out.push({ from: n, to });
      });
    });
    return out;
  }, [byId]);

  return (
    <Card
      title="Constellations"
      right={
        <Pill>
          ✦ {Math.floor(points)} pt{Math.floor(points) === 1 ? "" : "s"}
        </Pill>
      }
    >
      <div className="smallText" style={{ marginBottom: 10, opacity: 0.85 }}>
        Spend Constellation Points to restore star-paths. Each node permanently
        alters your world.
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          height: 360,
          borderRadius: 14,
          overflow: "hidden",
          background:
            "radial-gradient(120% 80% at 50% 20%, rgba(120,170,255,0.10), rgba(0,0,0,0) 60%), linear-gradient(#070714, #05040a)",
          border: "1px solid rgba(120,150,220,0.15)",
        }}
      >
        {/* Lines */}
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1000 600"
          style={{ position: "absolute", inset: 0 }}
        >
          {lines.map((L, i) => {
            const active =
              unlockedSet.has(L.from.id) && unlockedSet.has(L.to.id);
            return (
              <line
                key={i}
                x1={L.from.pos.x * 1000}
                y1={L.from.pos.y * 600}
                x2={L.to.pos.x * 1000}
                y2={L.to.pos.y * 600}
                stroke={
                  active ? "rgba(170,210,255,0.55)" : "rgba(120,140,200,0.18)"
                }
                strokeWidth={active ? 3 : 2}
              />
            );
          })}
        </svg>

        {/* Nodes */}
        {CONSTELLATIONS.map((n) => {
          const isUnlocked = unlockedSet.has(n.id);
          const can = canUnlock(n, unlocked, points);
          return (
            <div
              key={n.id}
              style={{
                position: "absolute",
                left: `${n.pos.x * 100}%`,
                top: `${n.pos.y * 100}%`,
                transform: "translate(-50%, -50%)",
                width: 220,
                pointerEvents: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: 10,
                  borderRadius: 14,
                  border: isUnlocked
                    ? "1px solid rgba(180,220,255,0.35)"
                    : can
                    ? "1px solid rgba(180,220,255,0.28)"
                    : "1px solid rgba(120,150,220,0.12)",
                  background: isUnlocked
                    ? "rgba(20,30,55,0.62)"
                    : "rgba(10,12,22,0.62)",
                  boxShadow: isUnlocked
                    ? "0 0 24px rgba(160,210,255,0.12)"
                    : "none",
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    marginTop: 2,
                    background: isUnlocked
                      ? "rgba(220,240,255,0.95)"
                      : can
                      ? "rgba(160,210,255,0.75)"
                      : "rgba(110,130,170,0.45)",
                    boxShadow: isUnlocked
                      ? "0 0 18px rgba(190,230,255,0.35)"
                      : can
                      ? "0 0 10px rgba(160,210,255,0.18)"
                      : "none",
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="rowBetween" style={{ gap: 10 }}>
                    <div style={{ fontWeight: 800, letterSpacing: 0.3 }}>
                      {n.name}
                    </div>
                    <Pill>{isUnlocked ? "Unlocked" : `${n.cost} pt`}</Pill>
                  </div>
                  <div
                    className="smallText"
                    style={{ marginTop: 6, opacity: 0.9 }}
                  >
                    {n.desc}
                  </div>

                  {!isUnlocked && (
                    <div style={{ marginTop: 10 }}>
                      <Button
                        variant={can ? "primary" : "secondary"}
                        disabled={!can}
                        onClick={() => onUnlock(n.id)}
                      >
                        Restore Star
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
