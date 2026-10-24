"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#08090d",
      color: "#f8fafc",
      padding: "2rem"
    }}>
      <div style={{
        maxWidth: "480px",
        width: "100%",
        padding: "2.5rem",
        borderRadius: "16px",
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        textAlign: "center"
      }}>
        <div style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "rgba(239, 68, 68, 0.15)",
          color: "#f87171",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 1.5rem"
        }}>
          <AlertTriangle size={28} />
        </div>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.75rem" }}>
          Se ha producido un error
        </h2>
        <p style={{ fontSize: "0.9rem", color: "#94a3b8", marginBottom: "1.75rem", lineHeight: 1.6 }}>
          Ocurrió un problema temporal al cargar esta vista. Puedes recargar la aplicación para continuar.
        </p>
        <button
          onClick={() => reset()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1.5rem",
            borderRadius: "8px",
            background: "#6366f1",
            color: "#fff",
            fontWeight: 600,
            border: "none",
            cursor: "pointer"
          }}
        >
          <RotateCcw size={16} />
          <span>Reintentar</span>
        </button>
      </div>
    </div>
  );
}
