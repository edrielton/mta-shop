import { createRoot } from "react-dom/client";
import { Component, type ReactNode } from "react";
import App from "./App";
import "./index.css";

// Error boundary — evita tela preta, mostra erro legível
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center",
          justifyContent: "center", background: "#0a0a0a", color: "#fff",
          fontFamily: "monospace", flexDirection: "column", gap: 16, padding: 24,
        }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <div style={{ fontSize: 20, fontWeight: "bold" }}>Erro na aplicação</div>
          <div style={{
            background: "#1a1a1a", border: "1px solid #333", borderRadius: 8,
            padding: 16, maxWidth: 600, wordBreak: "break-word", fontSize: 13,
          }}>
            <strong>{this.state.error.message}</strong>
            <pre style={{ marginTop: 8, opacity: 0.7, fontSize: 11, overflow: "auto" }}>
              {this.state.error.stack}
            </pre>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#2563eb", color: "#fff", border: "none",
              borderRadius: 6, padding: "8px 20px", cursor: "pointer", fontSize: 14,
            }}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
