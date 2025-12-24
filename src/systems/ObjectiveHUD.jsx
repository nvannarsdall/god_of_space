import React from "react";

export default function ObjectiveHUD({ objective }) {
  if (!objective) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 18,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 80,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderRadius: 14,
          background:
            "linear-gradient(180deg, rgba(16,20,30,0.92), rgba(8,10,16,0.78))",
          border: "1px solid rgba(255,255,255,0.22)",
          boxShadow:
            "0 12px 34px rgba(0,0,0,0.55), 0 0 18px rgba(74,163,255,0.18)",
          maxWidth: 820,
          minWidth: 420,
          textAlign: "center",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: 1,
            opacity: 0.85,
            marginBottom: 6,
            textTransform: "uppercase",
          }}
        >
          Objective
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>
          {objective.text}
        </div>
      </div>
    </div>
  );
}
