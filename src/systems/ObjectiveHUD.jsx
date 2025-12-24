import React from "react";

export default function ObjectiveHUD({ objective }) {
  if (!objective) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 14,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          background: "rgba(10,12,18,0.72)",
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          maxWidth: 620,
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
          Objective
        </div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{objective.text}</div>
      </div>
    </div>
  );
}
