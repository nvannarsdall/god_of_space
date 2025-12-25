import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import "./styles.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("App crashed:", error, info);
    this.setState({ info });
  }
  hardReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}
    location.reload();
  };
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
          <h2 style={{ margin: "0 0 8px 0" }}>God of Space crashed</h2>
          <p style={{ margin: "0 0 12px 0", opacity: 0.9 }}>
            Something threw during render. The message below will help pinpoint the file/line.
          </p>
          <pre style={{ whiteSpace: "pre-wrap", background: "rgba(0,0,0,0.06)", padding: 12, borderRadius: 8 }}>
{String(this.state.error)}
          </pre>
          <button
            onClick={this.hardReset}
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.2)",
              cursor: "pointer",
            }}
          >
            Hard reset save & reload
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
