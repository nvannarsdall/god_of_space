import { useEffect, useMemo, useRef, useState } from "react";
import { clamp } from "../game/state";
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
  const [panelHeight, setPanelHeight] = useState(240);
  const panelRef = useRef(null);

  useEffect(() => {
    const onResize = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const pad = 12;
  const list =
    Array.isArray(rects) && rects.length ? rects : rect ? [rect] : [];
  const rs = list.filter(Boolean).map((rr) => ({
    x: Math.max(0, rr.left - pad),
    y: Math.max(0, rr.top - pad),
    w: Math.max(0, rr.width + pad * 2),
    h: Math.max(0, rr.height + pad * 2),
  }));

  const r = rs.length ? rs[0] : null;

  useEffect(() => {
    if (!panelRef.current) return;
    const box = panelRef.current.getBoundingClientRect();
    if (box?.height) setPanelHeight(box.height);
  }, [title, body, viewport.w, viewport.h]);

  const panelStyle = useMemo(() => {
    if (!r) {
      return {
        left: "50%",
        bottom: "26px",
        transform: "translateX(-50%)",
      };
    }

    const panelWidth = Math.min(560, viewport.w - 32);
    const spaceBelow = viewport.h - (r.y + r.h);
    const placeBelow = spaceBelow >= panelHeight + 20;

    const top = placeBelow
      ? r.y + r.h + 16
      : Math.max(16, r.y - panelHeight - 16);

    return {
      width: panelWidth,
      left: clamp(
        r.x + r.w / 2 - panelWidth / 2,
        16,
        viewport.w - panelWidth - 16
      ),
      top: clamp(top, 16, viewport.h - panelHeight - 16),
      transform: "none",
    };
  }, [r, viewport, panelHeight]);

  return (
    <div className="tutOverlay">
      <svg className="tutSvg" width="100%" height="100%">
        <defs>
          <mask id="holeMask">
            <rect width="100%" height="100%" fill="white" />
            {rs.map((h, i) => (
              <rect
                key={i}
                x={h.x}
                y={h.y}
                width={h.w}
                height={h.h}
                rx="18"
                ry="18"
                fill="black"
              />
            ))}
          </mask>
        </defs>

        <rect
          width="100%"
          height="100%"
          fill="rgba(3,6,12,0.60)"
          mask="url(#holeMask)"
        />

        {rs.map((h, i) => (
          <rect
            key={i}
            x={h.x}
            y={h.y}
            width={h.w}
            height={h.h}
            rx="18"
            ry="18"
            fill="transparent"
            stroke={
              i === 0 ? "rgba(160,220,255,0.8)" : "rgba(160,220,255,0.45)"
            }
            strokeWidth={i === 0 ? "2" : "1.6"}
          />
        ))}
      </svg>

      <div ref={panelRef} className="tutPanel" style={panelStyle}>
        <div className="tutHeader">
          <div className="tutTitle">{title}</div>
          <div className="tutProgress">
            Step {step} of {total}
          </div>
        </div>

        <div className="tutBody">{body}</div>

        <div className="tutActions">
          <Button variant="ghost" onClick={onSkip}>
            Skip tutorial
          </Button>
          {showNext && <Button onClick={onNext}>{nextLabel}</Button>}
        </div>
      </div>
    </div>
  );
}

export default TutorialOverlay;
