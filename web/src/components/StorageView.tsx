"use client";

import React, { useEffect, useState } from "react";
import {
  HardDrive,
  Database,
  Layers,
  FolderOpen,
  Code2,
  RefreshCw,
  PlusCircle,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Server,
} from "lucide-react";

export function StorageView() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const loadStorage = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/storage");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "No se pudo obtener la información de almacenamiento",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStorage();
  }, []);

  const handleAction = async (action: "expand_disk" | "compact", addGb?: number) => {
    try {
      setActionLoading(action === "expand_disk" ? `expand_${addGb}` : "compact");
      setFeedback(null);
      const res = await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, addGb }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Error al ejecutar la operación");
      }
      setData(json);
      setFeedback({
        type: "success",
        text: json.message || "Operación completada con éxito.",
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Falló la operación de almacenamiento",
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ textAlign: "center", padding: "5rem 0", color: "var(--text-secondary)" }}>
        <p>Calculando espacio de bases de datos, índices vectoriales y disco...</p>
      </div>
    );
  }

  if (!data) return null;

  const { dataVolume, systemDisk, breakdown, summary } = data;
  const volPercent = dataVolume?.usedPercent || 0;
  const sysPercent = systemDisk?.usedPercent || 0;

  const totalAppDb = summary?.totalAppAndDbBytes || 1;
  const sqlitePct = Math.max(2, Math.round(((breakdown?.sqlite?.bytes || 0) / totalAppDb) * 100));
  const chromaSqlPct = Math.max(
    2,
    Math.round(((breakdown?.chroma?.sqliteBytes || 0) / totalAppDb) * 100)
  );
  const chromaHnswPct = Math.max(
    2,
    Math.round(((breakdown?.chroma?.hnswBytes || 0) / totalAppDb) * 100)
  );
  const appCodePct = Math.max(
    2,
    Math.round(((breakdown?.appCode?.totalBytes || 0) / totalAppDb) * 100)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.25rem", maxWidth: "1100px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div className="pill-tag" style={{ marginBottom: "0.75rem" }}>
            <HardDrive size={14} />
            <span>Monitor de Almacenamiento y Bases de Datos</span>
          </div>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.025em", marginBottom: "0.5rem" }}>
            Espacio de la Aplicación y Bases de Datos
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.98rem", maxWidth: "740px", lineHeight: 1.6 }}>
            Consulta el espacio ocupado por SQLite, ChromaDB, el entorno de la aplicación y tu biblioteca de libros EPUB, así como el espacio libre disponible en disco.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => handleAction("compact")}
            disabled={Boolean(actionLoading)}
            className="btn btn-secondary"
          >
            <Sparkles size={16} style={{ color: "var(--accent-cyan)" }} />
            <span>
              {actionLoading === "compact" ? "Optimizando..." : "Optimizar y Compactar BD"}
            </span>
          </button>
          <button
            type="button"
            onClick={loadStorage}
            disabled={loading}
            className="btn btn-secondary"
          >
            <RefreshCw size={16} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className="panel"
          style={{
            padding: "1rem 1.25rem",
            borderColor:
              feedback.type === "success"
                ? "rgba(16, 185, 129, 0.4)"
                : "rgba(244, 63, 94, 0.4)",
            background:
              feedback.type === "success"
                ? "rgba(16, 185, 129, 0.1)"
                : "rgba(244, 63, 94, 0.1)",
            color: feedback.type === "success" ? "#6ee7b7" : "#fda4af",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertTriangle size={18} />
          )}
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{feedback.text}</span>
        </div>
      )}

      {/* Top 2 Disk Volume Cards: Database Volume & Host Disk */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1.5rem" }}>
        {/* Card 1: Volumen de Datos (.epub_archive) */}
        <div className="panel" style={{ marginBottom: 0, display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: "rgba(99, 102, 241, 0.16)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#818cf8",
                }}
              >
                <Database size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>
                  Volumen de Bases de Datos
                </h2>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                  {dataVolume?.path}
                </span>
              </div>
            </div>
            <span
              className="pill-tag"
              style={{
                background:
                  volPercent > 90
                    ? "rgba(244, 63, 94, 0.2)"
                    : volPercent > 75
                    ? "rgba(245, 158, 11, 0.2)"
                    : "rgba(16, 185, 129, 0.2)",
                color:
                  volPercent > 90 ? "#fda4af" : volPercent > 75 ? "#fcd34d" : "#6ee7b7",
              }}
            >
              {volPercent}% en uso
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            <div className="card" style={{ padding: "0.85rem 1rem" }}>
              <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Espacio Ocupado</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff", marginTop: "0.2rem" }}>
                {dataVolume?.usedFormatted}
              </div>
            </div>
            <div className="card" style={{ padding: "0.85rem 1rem", borderColor: "rgba(16, 185, 129, 0.3)" }}>
              <div style={{ fontSize: "0.74rem", color: "#6ee7b7" }}>Disponible (Libre)</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#34d399", marginTop: "0.2rem" }}>
                {dataVolume?.availableFormatted}
              </div>
            </div>
            <div className="card" style={{ padding: "0.85rem 1rem" }}>
              <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Capacidad Total</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#cbd5e1", marginTop: "0.2rem" }}>
                {dataVolume?.totalFormatted}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div style={{ width: "100%", height: "10px", borderRadius: "6px", background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.min(100, volPercent)}%`,
                  height: "100%",
                  borderRadius: "6px",
                  background:
                    volPercent > 90
                      ? "linear-gradient(90deg, #f43f5e, #e11d48)"
                      : volPercent > 75
                      ? "linear-gradient(90deg, #f59e0b, #d97706)"
                      : "linear-gradient(90deg, #6366f1, #10b981)",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>

          {dataVolume?.isVirtualDisk && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "0.75rem",
                paddingTop: "0.75rem",
                borderTop: "1px solid var(--border-subtle)",
              }}
            >
              <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Ampliar disco virtual en caliente (sin pérdida de datos):
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {[10, 20, 30].map((gb) => (
                  <button
                    key={gb}
                    type="button"
                    onClick={() => handleAction("expand_disk", gb)}
                    disabled={Boolean(actionLoading)}
                    className="btn btn-sm btn-secondary"
                    style={{ fontSize: "0.76rem", padding: "0.3rem 0.65rem" }}
                  >
                    <PlusCircle size={13} />
                    <span>+{gb} GB</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Disco Físico del Sistema / Contenedor */}
        <div className="panel" style={{ marginBottom: 0, display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: "rgba(6, 182, 212, 0.16)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#22d3ee",
                }}
              >
                <Server size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>
                  Almacenamiento del Sistema Host
                </h2>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                  Volumen físico ({systemDisk?.path})
                </span>
              </div>
            </div>
            <span className="pill-tag" style={{ background: "rgba(6, 182, 212, 0.16)", color: "#67e8f9" }}>
              {sysPercent}% en uso
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            <div className="card" style={{ padding: "0.85rem 1rem" }}>
              <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Usado en Disco</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff", marginTop: "0.2rem" }}>
                {systemDisk?.usedFormatted}
              </div>
            </div>
            <div className="card" style={{ padding: "0.85rem 1rem", borderColor: "rgba(6, 182, 212, 0.3)" }}>
              <div style={{ fontSize: "0.74rem", color: "#67e8f9" }}>Espacio Libre Real</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#22d3ee", marginTop: "0.2rem" }}>
                {systemDisk?.availableFormatted}
              </div>
            </div>
            <div className="card" style={{ padding: "0.85rem 1rem" }}>
              <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>Total Disco</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#cbd5e1", marginTop: "0.2rem" }}>
                {systemDisk?.totalFormatted}
              </div>
            </div>
          </div>

          <div>
            <div style={{ width: "100%", height: "10px", borderRadius: "6px", background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.min(100, sysPercent)}%`,
                  height: "100%",
                  borderRadius: "6px",
                  background: "linear-gradient(90deg, #06b6d4, #3b82f6)",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>

          <div
            style={{
              fontSize: "0.8rem",
              color: "var(--text-secondary)",
              paddingTop: "0.5rem",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <span>Total App + Bases de Datos:</span>
            <strong style={{ color: "#fff" }}>{summary?.totalAppAndDbFormatted}</strong>
          </div>
        </div>
      </div>

      {/* Visual Proportional Distribution Bar */}
      <div className="panel" style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff" }}>
            Distribución del Espacio de la Aplicación ({summary?.totalAppAndDbFormatted})
          </h3>
          <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            Bases de datos: <strong>{summary?.totalDatabasesFormatted}</strong> • Código/Entorno:{" "}
            <strong>{breakdown?.appCode?.totalFormatted}</strong>
          </span>
        </div>

        <div
          style={{
            width: "100%",
            height: "18px",
            borderRadius: "9px",
            background: "rgba(255,255,255,0.05)",
            overflow: "hidden",
            display: "flex",
            gap: "2px",
            marginBottom: "1rem",
          }}
        >
          <div
            style={{ width: `${chromaSqlPct}%`, background: "#8b5cf6" }}
            title={`ChromaDB SQLite: ${breakdown?.chroma?.sqliteFormatted}`}
          />
          <div
            style={{ width: `${chromaHnswPct}%`, background: "#06b6d4" }}
            title={`ChromaDB HNSW Vectores: ${breakdown?.chroma?.hnswFormatted}`}
          />
          <div
            style={{ width: `${sqlitePct}%`, background: "#6366f1" }}
            title={`SQLite Principal (archive.sqlite3): ${breakdown?.sqlite?.formatted}`}
          />
          <div
            style={{ width: `${appCodePct}%`, background: "#10b981" }}
            title={`Aplicación y Entorno: ${breakdown?.appCode?.totalFormatted}`}
          />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", fontSize: "0.82rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#8b5cf6" }} />
            <span style={{ color: "var(--text-secondary)" }}>ChromaDB SQLite:</span>
            <strong style={{ color: "#fff" }}>{breakdown?.chroma?.sqliteFormatted}</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#06b6d4" }} />
            <span style={{ color: "var(--text-secondary)" }}>Índice HNSW Vectorial:</span>
            <strong style={{ color: "#fff" }}>{breakdown?.chroma?.hnswFormatted}</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#6366f1" }} />
            <span style={{ color: "var(--text-secondary)" }}>Catálogo SQLite (archive.sqlite3):</span>
            <strong style={{ color: "#fff" }}>{breakdown?.sqlite?.formatted}</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#10b981" }} />
            <span style={{ color: "var(--text-secondary)" }}>App (.venv + Next.js):</span>
            <strong style={{ color: "#fff" }}>{breakdown?.appCode?.totalFormatted}</strong>
          </div>
        </div>
      </div>

      {/* Detailed Breakdown Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
        {/* 1. SQLite Catalog & Chunks DB */}
        <div className="panel" style={{ marginBottom: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Database size={18} style={{ color: "#818cf8" }} />
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff" }}>
                SQLite Principal (archive.sqlite3)
              </h3>
            </div>
            <span className="pill-tag">{breakdown?.sqlite?.formatted}</span>
          </div>

          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            Almacena el catálogo bibliográfico, resúmenes, categorías, estados de lectura y el texto limpio de los capítulos.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", fontSize: "0.84rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Libros registrados:</span>
              <strong style={{ color: "#fff" }}>{breakdown?.sqlite?.booksCount?.toLocaleString()}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Fragmentos de texto (chunks):</span>
              <strong style={{ color: "#fff" }}>{breakdown?.sqlite?.chunksCount?.toLocaleString()}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Espacio libre interno reutilizable:</span>
              <strong style={{ color: "#6ee7b7" }}>{breakdown?.sqlite?.reclaimableFormatted}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Porcentaje de las BD:</span>
              <strong style={{ color: "#cbd5e1" }}>{breakdown?.sqlite?.percentOfDb}%</strong>
            </div>
          </div>
        </div>

        {/* 2. ChromaDB Vector Database */}
        <div className="panel" style={{ marginBottom: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Layers size={18} style={{ color: "#22d3ee" }} />
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff" }}>
                Base Vectorial ChromaDB
              </h3>
            </div>
            <span className="pill-tag" style={{ background: "rgba(6, 182, 212, 0.16)", color: "#67e8f9" }}>
              {breakdown?.chroma?.totalFormatted}
            </span>
          </div>

          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            Contiene los vectores semánticos para búsqueda por similitud y clustering temático HDBSCAN.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", fontSize: "0.84rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Motor SQLite de Chroma (chroma.sqlite3):</span>
              <strong style={{ color: "#fff" }}>{breakdown?.chroma?.sqliteFormatted}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Índice binario HNSW (vectores):</span>
              <strong style={{ color: "#22d3ee" }}>{breakdown?.chroma?.hnswFormatted}</strong>
            </div>
            {Array.isArray(breakdown?.chroma?.segments) &&
              breakdown.chroma.segments.slice(0, 3).map((seg: any) => (
                <div key={seg.name} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                  <span style={{ color: "var(--text-muted)", fontFamily: "monospace" }}>• {seg.name}:</span>
                  <span style={{ color: "var(--text-secondary)" }}>{seg.formatted}</span>
                </div>
              ))}
          </div>
        </div>

        {/* 3. Application Code & Dependencies */}
        <div className="panel" style={{ marginBottom: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Code2 size={18} style={{ color: "#34d399" }} />
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff" }}>
                Aplicación y Dependencias
              </h3>
            </div>
            <span className="pill-tag" style={{ background: "rgba(16, 185, 129, 0.16)", color: "#6ee7b7" }}>
              {breakdown?.appCode?.totalFormatted}
            </span>
          </div>

          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            Espacio ocupado por el código fuente, el entorno virtual de Python y los paquetes de la interfaz web.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", fontSize: "0.84rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Entorno Python (.venv):</span>
              <strong style={{ color: "#fff" }}>{breakdown?.appCode?.venvFormatted}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Dependencias Web (node_modules):</span>
              <strong style={{ color: "#fff" }}>{breakdown?.appCode?.nodeModulesFormatted}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Compilación Next.js (.next):</span>
              <strong style={{ color: "#fff" }}>{breakdown?.appCode?.nextBuildFormatted}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Código fuente (src + web/src):</span>
              <strong style={{ color: "#6ee7b7" }}>{breakdown?.appCode?.sourceFormatted}</strong>
            </div>
          </div>
        </div>

        {/* 4. EPUB Files Collection on Disk */}
        <div className="panel" style={{ marginBottom: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <FolderOpen size={18} style={{ color: "#f59e0b" }} />
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff" }}>
                Carpeta de Libros EPUB
              </h3>
            </div>
            <span className="pill-tag" style={{ background: "rgba(245, 158, 11, 0.16)", color: "#fcd34d" }}>
              {breakdown?.booksCollection?.formatted}
            </span>
          </div>

          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            Archivos físicos <code>.epub</code> almacenados en tu carpeta de biblioteca.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", fontSize: "0.84rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Ruta de la colección:</span>
              <span style={{ color: "#cbd5e1", fontFamily: "monospace", fontSize: "0.78rem" }}>
                {breakdown?.booksCollection?.path}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Archivos .epub en disco:</span>
              <strong style={{ color: "#fff" }}>
                {breakdown?.booksCollection?.fileCount?.toLocaleString()} archivos
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Tamaño total de los EPUBs:</span>
              <strong style={{ color: "#fcd34d" }}>{breakdown?.booksCollection?.formatted}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

