import React from "react";
import { clamp } from "../game/state";

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

export { Button, Card, Pill, Progress };
