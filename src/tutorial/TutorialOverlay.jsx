import { useEffect, useMemo, useRef, useState } from "react";
import { clamp } from "../game/state";
import { Button } from "../components/ui";

function TutorialOverlay({
  rect,
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
  const [panelHeight, setPanelHeight] = useState(220);
  const panelRef = useRef(null);

  useEffect(() => {
    const onResize = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const pad = 12;
  const r = rect
    ? {
        x: Math.max(0, rect.left - pad),
        y: Math.max(0, rect.top - pad),
        w: Math.max(0, rect.width + pad * 2),
        h: Math.max(0, rect.height + pad * 2),
      }
    : null;

  useEffect(() => {
    if (!panelRef.current) return;
    const update = () => {
      const box = panelRef.current?.getBoundingClientRect?.();
      if (box?.height) setPanelHeight(box.height);
    };
    update();
  }, [title, body, r, viewport.w, viewport.h]);

  const panelStyle = useMemo(() => {
    if (!r) {
      return {
        left: "50%",
        top: "auto",
        bottom: "26px",
        transform: "translateX(-50%)",
      };
    }

    const panelWidth = Math.min(560, viewport.w - 32);
    const preferBottom = r.y + r.h + 220 < viewport.h;
    const top = preferBottom ? r.y + r.h + 16 : Math.max(16, r.y - 210);
    const left = clamp(r.x + r.w / 2 - panelWidth / 2, 16, viewport.w - 16);
    const maxTop = Math.max(16, viewport.h - panelHeight - 16);

    return {
      width: panelWidth,
      left,
      top: clamp(top, 16, maxTop),
      bottom: "auto",
      transform: "none",
    };
  }, [r, viewport, panelHeight]);

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
          fill="rgba(3,6,12,0.82)"
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
            stroke="rgba(160,220,255,0.7)"
            strokeWidth="2"
          />
        )}
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
          {showNext && (
            <Button onClick={onNext}>
              {nextLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default TutorialOverlay;
