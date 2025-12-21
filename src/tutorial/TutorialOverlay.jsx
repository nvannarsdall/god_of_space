 codex/refactor-app.js-into-multiple-files-ivkzpn
import React, { useEffect, useMemo, useRef, useState } from "react";

import React, { useEffect, useMemo, useState } from "react";
 main
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
 codex/refactor-app.js-into-multiple-files-ivkzpn
  const [panelHeight, setPanelHeight] = useState(220);
  const panelRef = useRef(null);

 main

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

 codex/refactor-app.js-into-multiple-files-ivkzpn
  useEffect(() => {
    if (!panelRef.current) return;
    const update = () => {
      const box = panelRef.current?.getBoundingClientRect?.();
      if (box?.height) setPanelHeight(box.height);
    };
    update();
  }, [title, body, r, viewport.w, viewport.h]);


 main
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
 codex/refactor-app.js-into-multiple-files-ivkzpn
    const maxTop = Math.max(16, viewport.h - panelHeight - 16);
 main

    return {
      width: panelWidth,
      left,
 codex/refactor-app.js-into-multiple-files-ivkzpn
      top: clamp(top, 16, maxTop),
      bottom: "auto",
      transform: "none",
    };
  }, [r, viewport, panelHeight]);

      top,
      bottom: "auto",
      transform: "none",
    };
  }, [r, viewport]);
 main

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

 codex/refactor-app.js-into-multiple-files-ivkzpn
      <div ref={panelRef} className="tutPanel" style={panelStyle}>

      <div className="tutPanel" style={panelStyle}>
 main
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
