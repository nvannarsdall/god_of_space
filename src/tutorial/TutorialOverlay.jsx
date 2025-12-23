import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "../components/ui";

function TutorialOverlay({
  rect,
  rects,
  title,
  body,
  step,
  total,
  onNext,
  onSkip,
  nextLabel = "Next",
  showNext = true,
}) {
  const [viewport, setViewport] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });

  const panelRef = useRef(null);
  const [panelBox, setPanelBox] = useState({ w: 520, h: 220 });

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width && r.height) setPanelBox({ w: r.width, h: r.height });
  }, [title, body, step, total, nextLabel, showNext]);

  // Keep track of window size to recalculate positions on resize
  useEffect(() => {
    const onResize = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Calculate Holes (Spotlights)
  const pad = 12;
  // Normalize inputs: rects array takes precedence, fallback to single rect
  const list =
    Array.isArray(rects) && rects.length ? rects : rect ? [rect] : [];

  // Create safe rectangles for the SVG mask with padding
  const rs = list.filter(Boolean).map((rr) => ({
    x: rr.left - pad,
    y: rr.top - pad,
    w: rr.width + pad * 2,
    h: rr.height + pad * 2,
  }));

  // Determine Safe Position (Top vs Bottom dock)
  // Logic: If the MAIN target (first one) is in the top 60% of screen, dock text at bottom.
  // Otherwise dock text at top. This prevents the text from covering the target.
  const mainTarget = rs[0];

  const panelStyle = useMemo(() => {
    const margin = 18;
    const w = Math.min(600, viewport.w * 0.9);
    const h = Math.min(panelBox.h, viewport.h * 0.45);

    const candidates = [
      { key: "tl", top: margin, left: margin },
      { key: "tr", top: margin, right: margin },
      { key: "bl", bottom: margin, left: margin },
      { key: "br", bottom: margin, right: margin },
    ];

    const rectList = rs.length ? rs : mainTarget ? [mainTarget] : [];

    const scoreCandidate = (c) => {
      const x = c.left != null ? c.left : viewport.w - margin - w;
      const y = c.top != null ? c.top : viewport.h - margin - h;

      const panelRect = { x, y, w, h };

      let overlap = 0;
      let minDist = Infinity;

      for (const r of rectList) {
        const ox = Math.max(
          0,
          Math.min(panelRect.x + panelRect.w, r.x + r.w) -
            Math.max(panelRect.x, r.x)
        );
        const oy = Math.max(
          0,
          Math.min(panelRect.y + panelRect.h, r.y + r.h) -
            Math.max(panelRect.y, r.y)
        );
        overlap += ox * oy;

        const cx = panelRect.x + panelRect.w / 2;
        const cy = panelRect.y + panelRect.h / 2;
        const tx = r.x + r.w / 2;
        const ty = r.y + r.h / 2;
        const d = Math.hypot(cx - tx, cy - ty);
        minDist = Math.min(minDist, d);
      }

      // Prefer zero overlap; otherwise maximize distance from targets
      return { overlap, dist: minDist, c };
    };

    const scored = candidates.map(scoreCandidate);
    scored.sort((a, b) => {
      if (a.overlap !== b.overlap) return a.overlap - b.overlap;
      return b.dist - a.dist;
    });

    const best = scored[0]?.c || candidates[3];

    return {
      position: "fixed",
      width: `${w}px`,
      zIndex: 100,
      transition:
        "top 0.2s ease, bottom 0.2s ease, left 0.2s ease, right 0.2s ease",
      ...(best.top != null ? { top: best.top } : { top: "auto" }),
      ...(best.bottom != null ? { bottom: best.bottom } : { bottom: "auto" }),
      ...(best.left != null ? { left: best.left } : { left: "auto" }),
      ...(best.right != null ? { right: best.right } : { right: "auto" }),
    };
  }, [viewport.w, viewport.h, panelBox.h, rs, mainTarget]);

  return (
    <div
      className="tutOverlay"
      style={{ position: "fixed", inset: 0, zIndex: 90, pointerEvents: "none" }}
    >
      {/* 1. DARK MASK WITH HOLES (SVG) */}
      <svg
        className="tutSvg"
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <mask id="holeMask">
            {/* White base = transparent in mask, Black shapes = opaque/holes in mask */}
            <rect width="100%" height="100%" fill="white" />
            {rs.map((h, i) => (
              <rect
                key={i}
                x={h.x}
                y={h.y}
                width={h.w}
                height={h.h}
                rx="12"
                fill="black"
              />
            ))}
          </mask>
        </defs>

        {/* The dim background layer */}
        <rect
          width="100%"
          height="100%"
          fill="rgba(5, 4, 10, 0.75)"
          mask="url(#holeMask)"
        />

        {/* The glow rings around targets */}
        {rs.map((h, i) => (
          <rect
            key={i}
            x={h.x}
            y={h.y}
            width={h.w}
            height={h.h}
            rx="12"
            fill="transparent"
            stroke={i === 0 ? "#A0DCFF" : "rgba(160, 220, 255, 0.3)"}
            strokeWidth={i === 0 ? "2" : "1"}
            style={{
              animation: i === 0 ? "tutPulse 2s infinite" : "none",
            }}
          />
        ))}
      </svg>

      {/* 2. TEXT PANEL */}
      <div
        className="tutPanel"
        style={{ ...panelStyle, pointerEvents: "auto" }}
      >
        <div
          className="tutHeader"
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div
            className="tutTitle"
            style={{ fontWeight: 900, color: "#A0DCFF" }}
          >
            {title}
          </div>
          <div className="tutProgress" style={{ opacity: 0.6, fontSize: 12 }}>
            Step {step} of {total}
          </div>
        </div>

        <div className="tutBody" style={{ lineHeight: 1.5, marginBottom: 16 }}>
          {body}
        </div>

        <div
          className="tutActions"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Button
            variant="ghost"
            onClick={onSkip}
            style={{ fontSize: 12, opacity: 0.7 }}
          >
            End Tutorial
          </Button>

          {/* Only show Next if the task is done, OR if it's purely informational */}
          {showNext ? (
            <Button onClick={onNext} variant="primary">
              {nextLabel}
            </Button>
          ) : (
            <div
              style={{ fontSize: 12, color: "#A0DCFF", fontStyle: "italic" }}
            >
              Complete task to proceed...
            </div>
          )}
        </div>
      </div>

      {/* Self-contained styles for the pulse animation */}
      <style>{`
        @keyframes tutPulse {
            0% { stroke-opacity: 0.6; box-shadow: 0 0 0 0 rgba(160, 220, 255, 0.4); }
            50% { stroke-opacity: 1; box-shadow: 0 0 0 10px rgba(160, 220, 255, 0); }
            100% { stroke-opacity: 0.6; box-shadow: 0 0 0 0 rgba(160, 220, 255, 0); }
        }
      `}</style>
    </div>
  );
}

export default TutorialOverlay;
