import React, { useEffect, useState } from "react";
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

  // Determine a safe panel docking position that avoids covering the main target.
  // This prevents the tutorial panel from *visually* blocking upgrades/buttons even if clicks pass through.
  const mainTarget = rs[0];
  const margin = 18;

  const spaces = mainTarget
    ? {
        top: mainTarget.y,
        bottom: viewport.h - (mainTarget.y + mainTarget.h),
        left: mainTarget.x,
        right: viewport.w - (mainTarget.x + mainTarget.w),
      }
    : { top: viewport.h, bottom: viewport.h, left: viewport.w, right: viewport.w };

  const best = Object.entries(spaces).sort((a, b) => b[1] - a[1])[0]?.[0] ||
    "bottom";

  const baseStyle = {
    position: "fixed",
    width: "min(560px, 92vw)",
    zIndex: 100,
    pointerEvents: "auto",
  };

  let panelStyle;
  if (best === "left") {
    panelStyle = {
      ...baseStyle,
      left: margin,
      top: "50%",
      transform: "translateY(-50%)",
    };
  } else if (best === "right") {
    panelStyle = {
      ...baseStyle,
      right: margin,
      top: "50%",
      transform: "translateY(-50%)",
    };
  } else if (best === "top") {
    panelStyle = {
      ...baseStyle,
      top: margin,
      left: "50%",
      transform: "translateX(-50%)",
    };
  } else {
    panelStyle = {
      ...baseStyle,
      bottom: margin,
      left: "50%",
      transform: "translateX(-50%)",
    };
  }

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
      <div className="tutPanel" style={panelStyle}>
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
