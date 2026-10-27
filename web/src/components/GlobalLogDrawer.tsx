"use client";

import React, { useRef, useEffect, useState } from "react";
import {
  X,
  Square,
  Trash2,
  ExternalLink,
  Terminal,
  Clock,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  ArrowDownCircle,
} from "lucide-react";
import { useProcess } from "./ProcessContext";

interface GlobalLogDrawerProps {
  onNavigateToProcess?: () => void;
}

export function GlobalLogDrawer({ onNavigateToProcess }: GlobalLogDrawerProps) {
  const {
    isRunning,
    isStopping,
    progress,
    logs,
    lastFinish,
    isLogDrawerOpen,
    setIsLogDrawerOpen,
    stopProcess,
    clearLogs,
  } = useProcess();

  const [autoScroll, setAutoScroll] = useState(true);
  const [stopConfirm, setStopConfirm] = useState(false);
  const [stoppingAction, setStoppingAction] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const terminalBodyRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs, autoScroll]);

  // Handle user scrolling inside the terminal
  const handleScroll = () => {
    const el = terminalBodyRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (isAtBottom !== autoScroll) {
      setAutoScroll(isAtBottom);
    }
  };

  const handleStop = async () => {
    if (!stopConfirm) {
      setStopConfirm(true);
      return;
    }
    setStoppingAction(true);
    await stopProcess();
    setStoppingAction(false);
    setStopConfirm(false);
  };

  if (!isLogDrawerOpen) return null;

  return (
    <div className="process-drawer-overlay" onClick={() => setIsLogDrawerOpen(false)}>
      <div
        className="process-drawer-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Consola de indexación en tiempo real"
      >
        {/* Drawer Header */}
        <div className="process-drawer-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: isRunning
                  ? "rgba(99, 102, 241, 0.2)"
                  : "rgba(255, 255, 255, 0.06)",
                color: isRunning ? "var(--accent-primary)" : "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Terminal size={19} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h2
                  style={{
                    fontSize: "1.05rem",
                    fontWeight: 700,
                    color: "#fff",
                    whiteSpace: "nowrap",
                  }}
                >
                  Log en Tiempo Real
                </h2>
                {isRunning ? (
                  <span
                    className="pill-tag"
                    style={{
                      background: "rgba(16, 185, 129, 0.18)",
                      color: "#6ee7b7",
                      border: "1px solid rgba(16, 185, 129, 0.35)",
                      fontSize: "0.72rem",
                      padding: "0.15rem 0.5rem",
                    }}
                  >
                    <span className="status-dot online" />
                    <span>En ejecución</span>
                  </span>
                ) : isStopping ? (
                  <span
                    className="pill-tag"
                    style={{
                      background: "rgba(245, 158, 11, 0.18)",
                      color: "#fcd34d",
                      border: "1px solid rgba(245, 158, 11, 0.35)",
                      fontSize: "0.72rem",
                      padding: "0.15rem 0.5rem",
                    }}
                  >
                    <span className="status-dot" style={{ background: "#f59e0b" }} />
                    <span>Deteniendo...</span>
                  </span>
                ) : (
                  <span
                    className="pill-tag"
                    style={{
                      background: "rgba(255, 255, 255, 0.05)",
                      color: "var(--text-muted)",
                      fontSize: "0.72rem",
                      padding: "0.15rem 0.5rem",
                    }}
                  >
                    <span>Inactivo</span>
                  </span>
                )}
              </div>
              <p
                style={{
                  fontSize: "0.78rem",
                  color: "var(--text-muted)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                Pipeline de extracción, metadatos IA y embeddings vectoriales
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {/* Stop process button (Active whenever process is running or stopping) */}
            {(isRunning || isStopping) && (
              <button
                onClick={handleStop}
                disabled={stoppingAction || isStopping}
                className="btn btn-sm btn-danger"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  padding: "0.4rem 0.8rem",
                }}
                title="Detener el proceso actual"
              >
                <Square size={14} fill="currentColor" />
                <span>
                  {isStopping
                    ? "Deteniendo..."
                    : stopConfirm
                    ? "¿Confirmar parada?"
                    : "Detener"}
                </span>
              </button>
            )}

            {/* Clear logs */}
            {!isRunning && logs.length > 0 && (
              <button
                onClick={clearLogs}
                className="btn btn-sm btn-secondary"
                style={{ padding: "0.4rem 0.65rem", fontSize: "0.78rem" }}
                title="Limpiar log"
              >
                <Trash2 size={14} />
              </button>
            )}

            {/* Jump to processor tab */}
            {onNavigateToProcess && (
              <button
                onClick={() => {
                  onNavigateToProcess();
                  setIsLogDrawerOpen(false);
                }}
                className="btn btn-sm btn-secondary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.4rem 0.75rem",
                  fontSize: "0.78rem",
                }}
                title="Ver vista completa de Procesador"
              >
                <ExternalLink size={13} />
                <span className="hide-on-mobile">Configuración</span>
              </button>
            )}

            {/* Close drawer */}
            <button
              onClick={() => setIsLogDrawerOpen(false)}
              className="btn btn-sm btn-secondary"
              style={{ padding: "0.4rem 0.65rem" }}
              aria-label="Cerrar consola"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Live Progress Card (if running or progress exists) */}
        {progress && (
          <div
            style={{
              padding: "1rem 1.4rem",
              background: "rgba(16, 18, 26, 0.95)",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "0.85rem",
              }}
            >
              <span style={{ fontWeight: 700, color: "#fff" }}>
                Libro {progress.current} de {progress.total} ({progress.percent.toFixed(1)}%)
              </span>
              <span
                style={{
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontSize: "0.8rem",
                }}
              >
                <Clock size={13} style={{ color: "var(--accent-cyan)" }} />
                <span>ETA: {progress.eta}</span>
              </span>
            </div>

            <div
              style={{
                width: "100%",
                height: "6px",
                background: "rgba(255, 255, 255, 0.08)",
                borderRadius: "999px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress.percent}%`,
                  background:
                    "linear-gradient(90deg, var(--accent-primary) 0%, var(--accent-cyan) 100%)",
                  borderRadius: "999px",
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            <div
              style={{
                fontSize: "0.8rem",
                color: "#a5b4fc",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              <span style={{ color: "var(--text-muted)" }}>Procesando: </span>
              <span style={{ fontWeight: 600 }}>{progress.book}</span>
            </div>
          </div>
        )}

        {/* Terminal Header Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.6rem 1.4rem",
            background: "#090a10",
            borderBottom: "1px solid var(--border-subtle)",
            fontSize: "0.78rem",
            color: "var(--text-muted)",
          }}
        >
          <span>{logs.length} líneas de salida</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
            <button
              onClick={() => {
                setAutoScroll((prev) => !prev);
                if (!autoScroll) {
                  logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
                }
              }}
              style={{
                background: "transparent",
                border: "none",
                color: autoScroll ? "var(--accent-cyan)" : "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                fontSize: "0.75rem",
              }}
              title={autoScroll ? "Pausar scroll automático" : "Reanudar scroll automático"}
            >
              <ArrowDownCircle size={13} />
              <span>{autoScroll ? "Auto-scroll ON" : "Auto-scroll PAUSADO"}</span>
            </button>
          </div>
        </div>

        {/* Terminal Body */}
        <div
          ref={terminalBodyRef}
          onScroll={handleScroll}
          className="process-drawer-body"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1rem 1.4rem",
            background: "#050609",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: "0.82rem",
            lineHeight: 1.6,
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          {logs.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--text-muted)",
                gap: "0.75rem",
                padding: "3rem 1rem",
                textAlign: "center",
              }}
            >
              <Terminal size={32} style={{ opacity: 0.3 }} />
              <p>No hay registros de proceso recientes.</p>
              <p style={{ fontSize: "0.75rem" }}>
                Los eventos aparecerán aquí en vivo cuando inicies la indexación.
              </p>
            </div>
          ) : (
            logs.map((log) => {
              const isError = log.isStderr || log.text.includes("ERROR") || log.text.includes("falló");
              const isSuccess = log.text.includes("Completado") || log.text.includes("éxito");
              const isSystem = log.text.includes("[SISTEMA]");
              const isProgress = log.text.includes("Procesando:");

              let textColor = "#cbd5e1";
              if (isError) textColor = "#fda4af";
              else if (isSuccess) textColor = "#6ee7b7";
              else if (isSystem) textColor = "#fcd34d";
              else if (isProgress) textColor = "#93c5fd";

              return (
                <div
                  key={log.id}
                  style={{
                    color: textColor,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.6rem",
                    wordBreak: "break-word",
                  }}
                >
                  <span
                    style={{
                      color: "rgba(255,255,255,0.25)",
                      fontSize: "0.72rem",
                      flexShrink: 0,
                      userSelect: "none",
                    }}
                  >
                    {log.timestamp}
                  </span>
                  <span style={{ flex: 1 }}>{log.text}</span>
                </div>
              );
            })
          )}
          <div ref={logsEndRef} />
        </div>

        {/* Footer status / bar */}
        {lastFinish && !isRunning && !isStopping && (
          <div
            style={{
              padding: "0.75rem 1.4rem",
              background: lastFinish.stopped
                ? "rgba(245, 158, 11, 0.15)"
                : lastFinish.success
                ? "rgba(16, 185, 129, 0.15)"
                : "rgba(244, 63, 94, 0.15)",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "0.82rem",
              color: lastFinish.stopped
                ? "#fcd34d"
                : lastFinish.success
                ? "#6ee7b7"
                : "#fda4af",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {lastFinish.stopped ? (
                <AlertTriangle size={15} />
              ) : lastFinish.success ? (
                <CheckCircle2 size={15} />
              ) : (
                <AlertTriangle size={15} />
              )}
              <span>
                {lastFinish.stopped
                  ? "Proceso detenido por el usuario."
                  : lastFinish.success
                  ? "Indexación y clasificación completadas con éxito."
                  : `Proceso terminado con código de salida ${lastFinish.code}.`}
              </span>
            </div>
            {onNavigateToProcess && (
              <button
                onClick={() => {
                  onNavigateToProcess();
                  setIsLogDrawerOpen(false);
                }}
                className="btn btn-sm btn-secondary"
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
              >
                Nuevo proceso
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
