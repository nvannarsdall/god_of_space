import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import "./styles.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("App crashed:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#05040a",
            color: "#f2f0e5",
            padding: 16,
            overflow: "auto",
            fontFamily: "monospace",
          }}
        >
          <h2 style={{ marginTop: 0 }}>God of Space crashed</h2>
          <p style={{ opacity: 0.9 }}>
            Open the browser console for the full stack trace. This screen exists
            so you never get stuck on a black page.
          </p>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {String(this.state.error?.stack || this.state.error)}
          </pre>
          <button
            onClick={() => {
              try {
                localStorage.removeItem("GOD_OF_SPACE_STATE_V3");
                sessionStorage.removeItem("gos_started");
              } catch {}
              location.reload();
            }}
          >
            Hard Reset & Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById("root");
createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
