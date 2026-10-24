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
} from "lucide-react";

interface ProcessProgress {
  current: number;
  total: number;
  percent: number;
  eta: string;
  book: string;
}

interface ProcessViewProps {
  onProcessComplete: () => void;
}

export function ProcessView({ onProcessComplete }: ProcessViewProps) {
  const [inputDir, setInputDir] = useState("/Users/josea./Libros");
  const [force, setForce] = useState(false);
  const [maxBooks, setMaxBooks] = useState<number | "">("");
  const [categories, setCategories] = useState("");
  const [overlap, setOverlap] = useState(150);
  const [skipEmbeddings, setSkipEmbeddings] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<ProcessProgress | null>(null);
  const [logs, setLogs] = useState<Array<{ text: string; isStderr?: boolean }>>([]);
  const [finished, setFinished] = useState<{ success: boolean; code: number } | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const handleStartProcess = async () => {
    if (!inputDir.trim() || isRunning) return;

    setIsRunning(true);
    setProgress(null);
    setLogs([]);
    setFinished(null);

    try {
      const payload: any = {
        input_dir: inputDir.trim(),
        force,
        overlap,
        skip_embeddings: skipEmbeddings,
      };
      if (maxBooks !== "" && Number(maxBooks) > 0) {
        payload.max_books = Number(maxBooks);
      }
      if (categories.trim()) {
        payload.categories = categories.trim();
      }

      const response = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error HTTP ${response.status}`);
      }

      if (!response.body) throw new Error("No readable stream received");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(part.slice(6));
            if (data.type === "progress") {
              setProgress({
                current: data.current,
                total: data.total,
                percent: data.percent,
                eta: data.eta,
                book: data.book,
              });
              setLogs((prev) => [...prev, { text: data.raw }]);
            } else if (data.type === "log") {
              setLogs((prev) => [...prev, { text: data.line, isStderr: data.isStderr }]);
            } else if (data.type === "finish") {
              setFinished({ success: data.success, code: data.code });
              onProcessComplete();
            } else if (data.type === "error") {
              setLogs((prev) => [...prev, { text: `ERROR: ${data.message}`, isStderr: true }]);
              setFinished({ success: false, code: 1 });
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setLogs((prev) => [...prev, { text: `Fallo al iniciar proceso: ${err.message}`, isStderr: true }]);
      setFinished({ success: false, code: 1 });
    } finally {
      setIsRunning(false);
    }
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

      {/* Configuration Form Card with generous padding */}
      <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <Sliders size={18} style={{ color: "var(--accent-primary)" }} />
          <span>Configuración del Trabajo</span>
        </h2>

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
            disabled={isRunning}
            placeholder="/Users/josea./Libros"
            className="form-input"
            style={{ fontFamily: "monospace", fontSize: "0.95rem" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Carpeta principal de tu colección de libros EPUB.
            </p>
            {inputDir !== "/Users/josea./Libros" && (
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
              disabled={isRunning}
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
              disabled={isRunning}
              placeholder="Todos los encontrados"
              className="form-input"
              style={{ fontSize: "0.88rem" }}
            />
          </div>
        </div>

        {/* Toggles */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border-subtle)", fontSize: "0.88rem", color: "var(--text-secondary)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              disabled={isRunning}
              style={{ width: "18px", height: "18px", accentColor: "var(--accent-primary)", cursor: "pointer" }}
            />
            <span>Forzar reprocesamiento de libros sin cambios (--force)</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={skipEmbeddings}
              onChange={(e) => setSkipEmbeddings(e.target.checked)}
              disabled={isRunning}
              style={{ width: "18px", height: "18px", accentColor: "var(--accent-primary)", cursor: "pointer" }}
            />
            <span>Modo rápido (omite generación de vectores)</span>
          </label>
        </div>

        {/* Launch Button with generous spacing & size */}
        <div style={{ paddingTop: "0.5rem" }}>
          <button
            onClick={handleStartProcess}
            disabled={isRunning || !inputDir.trim()}
            className="btn btn-primary btn-lg"
            style={{ width: "100%", padding: "1.15rem 2rem", fontSize: "1.05rem" }}
          >
            {isRunning ? (
              <>
                <div style={{ width: "18px", height: "18px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <span>Pipeline en Ejecución...</span>
              </>
            ) : (
              <>
                <PlayCircle size={22} />
                <span>Iniciar Procesamiento de Colección</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress & Live Console View */}
      {(isRunning || logs.length > 0) && (
        <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Terminal size={18} style={{ color: "var(--accent-cyan)" }} />
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>Consola de Progreso en Vivo</h3>
            </div>
            {isRunning && (
              <span className="pill-tag" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#6ee7b7" }}>
                <span className="status-dot online" />
                <span>En tiempo real</span>
              </span>
            )}
            {finished && (
              <span
                className="pill-tag"
                style={{
                  background: finished.success ? "rgba(16, 185, 129, 0.2)" : "rgba(244, 63, 94, 0.2)",
                  color: finished.success ? "#6ee7b7" : "#fda4af",
                  borderColor: finished.success ? "rgba(16, 185, 129, 0.4)" : "rgba(244, 63, 94, 0.4)",
                }}
              >
                {finished.success ? "Finalizado con éxito" : `Terminado con código ${finished.code}`}
              </span>
            )}
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
              <span>Salida estándar / eventos</span>
              <span>bash/pipe</span>
            </div>
            <div className="terminal-body">
              {logs.map((log, index) => (
                <div
                  key={index}
                  style={{
                    color: log.isStderr ? "#fda4af" : log.text.includes("Procesado:") ? "#6ee7b7" : "#cbd5e1",
                  }}
                >
                  {log.text}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
