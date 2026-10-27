"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  PlayCircle,
  FolderOpen,
  Sliders,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Square,
  Trash2,
  ArrowDownCircle,
  AlertTriangle,
} from "lucide-react";
import { useProcess } from "./ProcessContext";

interface ProcessViewProps {
  onProcessComplete?: () => void;
}

export function ProcessView({ onProcessComplete }: ProcessViewProps) {
  const {
    isRunning,
    isStopping,
    progress,
    logs,
    lastFinish,
    startProcess,
    stopProcess,
    clearLogs,
  } = useProcess();

  const [inputDir, setInputDir] = useState("/Users/josea./Libros");
  const [force, setForce] = useState(false);
  const [maxBooks, setMaxBooks] = useState<number | "">("");
  const [categories, setCategories] = useState("");
  const [overlap, setOverlap] = useState(150);
  const [skipEmbeddings, setSkipEmbeddings] = useState(false);

  const [confirmStop, setConfirmStop] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

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

  // Handle user scrolling
  const handleScroll = () => {
    const el = terminalBodyRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (isAtBottom !== autoScroll) {
      setAutoScroll(isAtBottom);
    }
  };

  const handleStartProcess = async () => {
    if (!inputDir.trim() || isRunning) return;
    setStartError(null);
    setConfirmStop(false);

    const res = await startProcess({
      inputDir,
      force,
      maxBooks,
      categories,
      overlap,
      skipEmbeddings,
    });

    if (!res.success && res.error) {
      setStartError(res.error);
    }
  };

  const handleStopProcess = async () => {
    if (!confirmStop) {
      setConfirmStop(true);
      return;
    }
    setConfirmStop(false);
    await stopProcess();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem", maxWidth: "1050px", margin: "0 auto" }}>
      {/* Top Header */}
      <div>
        <div className="pill-tag" style={{ marginBottom: "0.8rem" }}>
          <PlayCircle size={14} />
          <span>Ejecución del Pipeline de 4 Etapas</span>
        </div>
        <h1 style={{ fontSize: "2.3rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.025em", marginBottom: "0.6rem" }}>
          Procesar Colección de Libros EPUB
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "1rem", lineHeight: 1.6, maxWidth: "750px" }}>
          Recorre carpetas recursivamente, extrae texto limpio de los XHTML, valida metadatos con IA, genera fragmentos semánticos y almacena en SQLite y ChromaDB.
        </p>
      </div>

      {/* Start error notification if any */}
      {startError && (
        <div
          className="panel"
          style={{
            borderColor: "rgba(244, 63, 94, 0.4)",
            background: "rgba(244, 63, 94, 0.08)",
            display: "flex",
            alignItems: "center",
            gap: "0.8rem",
            color: "#fda4af",
          }}
        >
          <AlertCircle size={20} />
          <span>{startError}</span>
        </div>
      )}

      {/* Configuration Form Card with generous padding */}
      <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Sliders size={18} style={{ color: "var(--accent-primary)" }} />
            <span>Configuración del Trabajo</span>
          </h2>
          {isRunning && (
            <span
              className="pill-tag"
              style={{
                background: "rgba(16, 185, 129, 0.18)",
                color: "#6ee7b7",
                border: "1px solid rgba(16, 185, 129, 0.35)",
              }}
            >
              <span className="status-dot online" />
              <span>Proceso en ejecución</span>
            </span>
          )}
          {isStopping && (
            <span
              className="pill-tag"
              style={{
                background: "rgba(245, 158, 11, 0.18)",
                color: "#fcd34d",
                border: "1px solid rgba(245, 158, 11, 0.35)",
              }}
            >
              <span className="status-dot" style={{ background: "#f59e0b" }} />
              <span>Deteniendo proceso...</span>
            </span>
          )}
        </div>

        {/* Directory Input */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <label style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <FolderOpen size={16} style={{ color: "var(--accent-cyan)" }} />
            <span>Ruta de la Carpeta de Libros:</span>
          </label>
          <input
            type="text"
            value={inputDir}
            onChange={(e) => setInputDir(e.target.value)}
            disabled={isRunning || isStopping}
            placeholder="/Users/josea./Libros"
            className="form-input"
            style={{ fontFamily: "monospace", fontSize: "0.95rem" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Carpeta principal de tu colección de libros EPUB.
            </p>
            {inputDir !== "/Users/josea./Libros" && !isRunning && (
              <button
                type="button"
                onClick={() => setInputDir("/Users/josea./Libros")}
                className="btn btn-sm btn-secondary"
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.65rem" }}
              >
                Restablecer a /Users/josea./Libros
              </button>
            )}
          </div>
        </div>

        {/* Advanced Options Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.75rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border-subtle)" }}>
          {/* Zero-Shot Categories */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
              Taxonomía Zero-Shot fija (opcional):
            </label>
            <input
              type="text"
              value={categories}
              onChange={(e) => setCategories(e.target.value)}
              disabled={isRunning || isStopping}
              placeholder="Ej: Ciencia, Ficción, Historia, Filosofía"
              className="form-input"
              style={{ fontSize: "0.88rem" }}
            />
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              Deja vacío para que el LLM proponga categorías abiertas.
            </p>
          </div>

          {/* Max Books Limit */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
              Límite de libros a procesar (opcional):
            </label>
            <input
              type="number"
              min={1}
              value={maxBooks}
              onChange={(e) => setMaxBooks(e.target.value ? parseInt(e.target.value, 10) : "")}
              disabled={isRunning || isStopping}
              placeholder="Todos los encontrados"
              className="form-input"
              style={{ fontSize: "0.88rem" }}
            />
          </div>
        </div>

        {/* Toggles */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border-subtle)", fontSize: "0.88rem", color: "var(--text-secondary)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: isRunning ? "not-allowed" : "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              disabled={isRunning || isStopping}
              style={{ width: "18px", height: "18px", accentColor: "var(--accent-primary)", cursor: isRunning ? "not-allowed" : "pointer" }}
            />
            <span>Forzar reprocesamiento de libros sin cambios (--force)</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: isRunning ? "not-allowed" : "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={skipEmbeddings}
              onChange={(e) => setSkipEmbeddings(e.target.checked)}
              disabled={isRunning || isStopping}
              style={{ width: "18px", height: "18px", accentColor: "var(--accent-primary)", cursor: isRunning ? "not-allowed" : "pointer" }}
            />
            <span>Modo rápido (omite generación de vectores)</span>
          </label>
        </div>

        {/* Action Button: Start or Stop with generous spacing & size */}
        <div style={{ paddingTop: "0.5rem", display: "flex", gap: "1rem" }}>
          {isRunning || isStopping ? (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <button
                onClick={handleStopProcess}
                disabled={isStopping}
                className="btn btn-danger btn-lg"
                style={{
                  width: "100%",
                  padding: "1.15rem 2rem",
                  fontSize: "1.05rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.75rem",
                  fontWeight: 700,
                  boxShadow: "0 0 24px rgba(244, 63, 94, 0.35)",
                }}
              >
                {isStopping ? (
                  <>
                    <div
                      style={{
                        width: "18px",
                        height: "18px",
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    <span>Deteniendo proceso... Enviando señal...</span>
                  </>
                ) : (
                  <>
                    <Square size={20} fill="currentColor" />
                    <span>{confirmStop ? "⚠️ ¿Confirmar detención del proceso?" : "Detener Proceso de Indexación"}</span>
                  </>
                )}
              </button>
              {confirmStop && !isStopping && (
                <button
                  type="button"
                  onClick={() => setConfirmStop(false)}
                  className="btn btn-sm btn-secondary"
                  style={{ alignSelf: "center", fontSize: "0.8rem", padding: "0.3rem 0.8rem" }}
                >
                  Cancelar y continuar proceso
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={handleStartProcess}
              disabled={!inputDir.trim()}
              className="btn btn-primary btn-lg"
              style={{ width: "100%", padding: "1.15rem 2rem", fontSize: "1.05rem" }}
            >
              <PlayCircle size={22} />
              <span>Iniciar Procesamiento de Colección</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress & Live Console View */}
      {(isRunning || isStopping || logs.length > 0) && (
        <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Terminal size={18} style={{ color: "var(--accent-cyan)" }} />
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>Consola de Progreso en Vivo</h3>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {isRunning && (
                <span className="pill-tag" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#6ee7b7" }}>
                  <span className="status-dot online" />
                  <span>En tiempo real</span>
                </span>
              )}
              {isStopping && (
                <span className="pill-tag" style={{ background: "rgba(245, 158, 11, 0.2)", color: "#fcd34d" }}>
                  <span className="status-dot" style={{ background: "#f59e0b" }} />
                  <span>Deteniendo...</span>
                </span>
              )}
              {lastFinish && !isRunning && !isStopping && (
                <span
                  className="pill-tag"
                  style={{
                    background: lastFinish.stopped
                      ? "rgba(245, 158, 11, 0.2)"
                      : lastFinish.success
                      ? "rgba(16, 185, 129, 0.2)"
                      : "rgba(244, 63, 94, 0.2)",
                    color: lastFinish.stopped
                      ? "#fcd34d"
                      : lastFinish.success
                      ? "#6ee7b7"
                      : "#fda4af",
                    borderColor: lastFinish.stopped
                      ? "rgba(245, 158, 11, 0.4)"
                      : lastFinish.success
                      ? "rgba(16, 185, 129, 0.4)"
                      : "rgba(244, 63, 94, 0.4)",
                  }}
                >
                  {lastFinish.stopped
                    ? "Detenido por el usuario"
                    : lastFinish.success
                    ? "Finalizado con éxito"
                    : `Terminado con código ${lastFinish.code}`}
                </span>
              )}

              {/* Stop button in console header */}
              {isRunning && (
                <button
                  onClick={handleStopProcess}
                  disabled={isStopping}
                  className="btn btn-sm btn-danger"
                  style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", padding: "0.35rem 0.7rem" }}
                  title="Detener proceso"
                >
                  <Square size={13} fill="currentColor" />
                  <span>{confirmStop ? "¿Confirmar?" : "Detener"}</span>
                </button>
              )}

              {/* Clear logs */}
              {!isRunning && logs.length > 0 && (
                <button
                  onClick={clearLogs}
                  className="btn btn-sm btn-secondary"
                  style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", padding: "0.35rem 0.7rem" }}
                  title="Limpiar registros de la consola"
                >
                  <Trash2 size={13} />
                  <span>Limpiar</span>
                </button>
              )}
            </div>
          </div>

          {/* Animated Progress Bar */}
          {progress && (
            <div className="card" style={{ padding: "1.4rem 1.8rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.9rem" }}>
                <span style={{ fontWeight: 700, color: "#fff" }}>
                  Libro {progress.current} de {progress.total} ({progress.percent.toFixed(1)}%)
                </span>
                <span style={{ color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Clock size={15} style={{ color: "var(--accent-cyan)" }} />
                  <span>ETA restante: {progress.eta}</span>
                </span>
              </div>

              <div className="progress-track">
                <div className="progress-bar" style={{ width: `${progress.percent}%` }} />
              </div>

              <div style={{ fontSize: "0.85rem", color: "#a5b4fc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                <span style={{ color: "var(--text-muted)" }}>Procesando actualmente: </span>
                <span style={{ fontWeight: 600 }}>{progress.book}</span>
              </div>
            </div>
          )}

          {/* Terminal log output */}
          <div className="terminal-console">
            <div className="terminal-header">
              <span>Salida estándar / eventos ({logs.length} líneas)</span>
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
              >
                <ArrowDownCircle size={13} />
                <span>{autoScroll ? "Auto-scroll ON" : "Auto-scroll PAUSADO"}</span>
              </button>
            </div>
            <div
              ref={terminalBodyRef}
              onScroll={handleScroll}
              className="terminal-body"
            >
              {logs.map((log) => {
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
                    <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.72rem", flexShrink: 0, userSelect: "none" }}>
                      {log.timestamp}
                    </span>
                    <span style={{ flex: 1 }}>{log.text}</span>
                  </div>
                );
              })}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
