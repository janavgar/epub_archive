"use client";

import React, { useState } from "react";
import { Terminal, Square, Clock, AlertTriangle } from "lucide-react";
import { useProcess } from "./ProcessContext";

export function ProcessFloatingWidget() {
  const { isRunning, isStopping, progress, isLogDrawerOpen, setIsLogDrawerOpen, stopProcess } = useProcess();
  const [confirmStop, setConfirmStop] = useState(false);
  const [stopping, setStopping] = useState(false);

  // Only show if process is running or stopping and drawer is not open
  if ((!isRunning && !isStopping) || isLogDrawerOpen) {
    return null;
  }

  const handleStop = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmStop) {
      setConfirmStop(true);
      return;
    }
    setStopping(true);
    await stopProcess();
    setStopping(false);
    setConfirmStop(false);
  };

  return (
    <div
      className="process-floating-widget"
      onClick={() => setIsLogDrawerOpen(true)}
      role="status"
      aria-live="polite"
    >
      <div className="process-floating-inner">
        {/* Left icon with pulse ring */}
        <div className="process-floating-icon-wrap">
          <div className={`process-floating-pulse ${isStopping ? "stopping" : "running"}`} />
          <Terminal size={16} />
        </div>

        {/* Center info */}
        <div className="process-floating-info">
          <div className="process-floating-title-row">
            <span className="process-floating-title">
              {isStopping
                ? "Deteniendo proceso..."
                : progress
                ? `Indexando (${progress.percent.toFixed(0)}%)`
                : "Indexando colección..."}
            </span>
            {progress && (
              <span className="process-floating-counter">
                {progress.current}/{progress.total}
              </span>
            )}
          </div>

          {progress ? (
            <>
              <div className="process-floating-bar-track">
                <div
                  className="process-floating-bar-fill"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p className="process-floating-book" title={progress.book}>
                {progress.book}
              </p>
            </>
          ) : (
            <p className="process-floating-book">Extrayendo textos y metadatos con IA...</p>
          )}
        </div>

        {/* Actions */}
        <div className="process-floating-actions" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setIsLogDrawerOpen(true)}
            className="btn btn-sm btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem" }}
            title="Abrir terminal de log en tiempo real"
          >
            Ver Log
          </button>

          <button
            onClick={handleStop}
            disabled={stopping || isStopping}
            className="btn btn-sm btn-danger"
            style={{
              fontSize: "0.75rem",
              padding: "0.3rem 0.65rem",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
            title="Detener indexación"
          >
            <Square size={12} fill="currentColor" />
            <span>
              {isStopping
                ? "Deteniendo..."
                : confirmStop
                ? "¿Seguro?"
                : "Detener"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
