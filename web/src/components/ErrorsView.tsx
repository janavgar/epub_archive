"use client";

import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  FolderOpen,
  Copy,
  Check,
  Search,
  Download,
  BookOpen,
  RefreshCw,
  FileCode,
  ShieldAlert,
  PlayCircle,
  FileQuestion,
  ChevronRight,
} from "lucide-react";
import { BookDetail } from "@/lib/db";
import { NavTab } from "./Navbar";

interface ErrorsViewProps {
  onSelectBook: (book: BookDetail) => void;
  onNavigate: (tab: NavTab) => void;
  onRefreshStats?: () => void;
}

type ErrorFilter = "all" | "corrupt" | "ai" | "structure" | "other";

export function ErrorsView({ onSelectBook, onNavigate }: ErrorsViewProps) {
  const [errorBooks, setErrorBooks] = useState<BookDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<ErrorFilter>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const loadErrors = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/books/errors");
      const data = await res.json();
      setErrorBooks(data.books || []);
    } catch {
      setErrorBooks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadErrors();
  }, []);

  const getErrorCategory = (err?: string | null): { type: ErrorFilter; label: string; color: string; bg: string } => {
    const errorText = (err || "").toLowerCase();
    if (errorText.includes("bad zip") || errorText.includes("not a zip")) {
      return {
        type: "corrupt",
        label: "Archivo Dañado (Bad Zip)",
        color: "#fb7185",
        bg: "rgba(244, 63, 94, 0.15)",
      };
    }
    if (errorText.includes("json") || errorText.includes("ia") || errorText.includes("decodificar") || errorText.includes("modelo")) {
      return {
        type: "ai",
        label: "Fallo Respuesta IA / JSON",
        color: "#fbbf24",
        bg: "rgba(251, 191, 36, 0.15)",
      };
    }
    if (errorText.includes("there is no item") || errorText.includes("link") || errorText.includes("missing") || errorText.includes("spine")) {
      return {
        type: "structure",
        label: "Estructura / Archivos Faltantes",
        color: "#f472b6",
        bg: "rgba(244, 114, 182, 0.15)",
      };
    }
    return {
      type: "other",
      label: "Error de Extracción",
      color: "#94a3b8",
      bg: "rgba(148, 163, 184, 0.15)",
    };
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyReport = () => {
    const lines = [
      `# Reporte de EPUBs no clasificados por error (${filteredBooks.length} archivos)`,
      `Fecha: ${new Date().toLocaleString()}`,
      "",
    ];

    filteredBooks.forEach((b, i) => {
      const cat = getErrorCategory(b.error);
      lines.push(`[${i + 1}] ${b.title} — ${b.author}`);
      lines.push(`    Ruta: ${b.id}`);
      lines.push(`    Tipo: ${cat.label}`);
      lines.push(`    Error: ${b.error || "Desconocido"}`);
      lines.push("");
    });

    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 3000);
  };

  const handleRevealFinder = async (bookId: string) => {
    try {
      setActionStatus("Abriendo en Finder...");
      const res = await fetch(`/api/books/${encodeURIComponent(bookId)}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reveal: true }),
      });
      const data = await res.json();
      if (data.success) {
        setActionStatus("Archivo mostrado en Finder");
      } else {
        setActionStatus("No se pudo revelar en Finder");
      }
    } catch {
      setActionStatus("Error al comunicar con el sistema");
    } finally {
      setTimeout(() => setActionStatus(null), 3500);
    }
  };

  // Group counts
  const corruptCount = errorBooks.filter((b) => getErrorCategory(b.error).type === "corrupt").length;
  const aiCount = errorBooks.filter((b) => getErrorCategory(b.error).type === "ai").length;
  const structureCount = errorBooks.filter((b) => getErrorCategory(b.error).type === "structure").length;
  const otherCount = errorBooks.filter((b) => getErrorCategory(b.error).type === "other").length;

  const filteredBooks = errorBooks.filter((book) => {
    const matchesSearch =
      !search.trim() ||
      book.title.toLowerCase().includes(search.toLowerCase()) ||
      book.author.toLowerCase().includes(search.toLowerCase()) ||
      (book.error || "").toLowerCase().includes(search.toLowerCase()) ||
      book.id.toLowerCase().includes(search.toLowerCase());

    const cat = getErrorCategory(book.error);
    const matchesFilter = filterType === "all" || cat.type === filterType;

    return matchesSearch && matchesFilter;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header Banner */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", marginBottom: "0.4rem" }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "rgba(244, 63, 94, 0.18)",
              color: "#fb7185",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <AlertTriangle size={20} />
            </div>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
              Libros no Clasificados por Error
            </h1>
            <span
              className="pill-tag"
              style={{
                background: "rgba(244, 63, 94, 0.2)",
                color: "#fda4af",
                borderColor: "rgba(244, 63, 94, 0.35)",
                fontSize: "0.82rem",
                fontWeight: 700,
              }}
            >
              {errorBooks.length} fallidos
            </span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", maxWidth: "720px", lineHeight: 1.5 }}>
            Listado detallado de archivos EPUB que no pudieron completarse durante el procesamiento. Aquí puedes consultar la causa exacta, localizar el archivo en Finder y reintentar su clasificación.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={handleCopyReport}
            className="btn btn-secondary"
            title="Copiar lista de errores como reporte al portapapeles"
          >
            {copiedReport ? (
              <>
                <Check size={16} style={{ color: "var(--accent-emerald)" }} />
                <span style={{ color: "var(--accent-emerald)" }}>Reporte Copiado</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>Copiar Reporte</span>
              </>
            )}
          </button>

          <button
            onClick={() => onNavigate("process")}
            className="btn btn-primary"
            title="Ir al procesador para reejecutar la extracción"
          >
            <PlayCircle size={16} />
            <span>Abrir Procesador</span>
          </button>

          <button
            onClick={loadErrors}
            className="btn btn-secondary"
            title="Actualizar lista"
          >
            <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>
      </div>

      {actionStatus && (
        <div style={{
          padding: "0.85rem 1.25rem",
          borderRadius: "var(--radius-md)",
          background: "rgba(99, 102, 241, 0.15)",
          border: "1px solid rgba(99, 102, 241, 0.3)",
          color: "#c7d2fe",
          fontSize: "0.88rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem"
        }}>
          <Check size={16} style={{ color: "var(--accent-emerald)" }} />
          <span>{actionStatus}</span>
        </div>
      )}

      {/* Category Summary Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "1rem"
      }}>
        {/* All */}
        <div
          onClick={() => setFilterType("all")}
          className={`card card-hover ${filterType === "all" ? "active" : ""}`}
          style={{
            padding: "1.1rem 1.3rem",
            cursor: "pointer",
            border: filterType === "all" ? "1px solid var(--accent-primary)" : undefined,
            background: filterType === "all" ? "rgba(99, 102, 241, 0.12)" : undefined,
          }}
        >
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.3rem" }}>Todos los fallidos</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff" }}>{errorBooks.length}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>Total en la base de datos</div>
        </div>

        {/* Bad Zip */}
        <div
          onClick={() => setFilterType("corrupt")}
          className={`card card-hover ${filterType === "corrupt" ? "active" : ""}`}
          style={{
            padding: "1.1rem 1.3rem",
            cursor: "pointer",
            border: filterType === "corrupt" ? "1px solid #fb7185" : undefined,
            background: filterType === "corrupt" ? "rgba(244, 63, 94, 0.12)" : undefined,
          }}
        >
          <div style={{ fontSize: "0.8rem", color: "#fda4af", marginBottom: "0.3rem" }}>Archivos Dañados (Bad Zip)</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fb7185" }}>{corruptCount}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>EPUBs corruptos o truncados</div>
        </div>

        {/* AI / JSON glitch */}
        <div
          onClick={() => setFilterType("ai")}
          className={`card card-hover ${filterType === "ai" ? "active" : ""}`}
          style={{
            padding: "1.1rem 1.3rem",
            cursor: "pointer",
            border: filterType === "ai" ? "1px solid #fbbf24" : undefined,
            background: filterType === "ai" ? "rgba(251, 191, 36, 0.12)" : undefined,
          }}
        >
          <div style={{ fontSize: "0.8rem", color: "#fde68a", marginBottom: "0.3rem" }}>Fallo Respuesta IA / JSON</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fbbf24" }}>{aiCount}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>Recuperables al reintentar</div>
        </div>

        {/* Internal Structure */}
        <div
          onClick={() => setFilterType("structure")}
          className={`card card-hover ${filterType === "structure" ? "active" : ""}`}
          style={{
            padding: "1.1rem 1.3rem",
            cursor: "pointer",
            border: filterType === "structure" ? "1px solid #f472b6" : undefined,
            background: filterType === "structure" ? "rgba(244, 114, 182, 0.12)" : undefined,
          }}
        >
          <div style={{ fontSize: "0.8rem", color: "#fbcfe8", marginBottom: "0.3rem" }}>Estructura OPF / Archivos</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#f472b6" }}>{structureCount}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>Capítulos o fuentes ausentes</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="panel" style={{ padding: "1.25rem", display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: "280px", position: "relative" }}>
          <Search size={18} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por título, autor o mensaje de error..."
            className="form-input"
            style={{ paddingLeft: "2.8rem" }}
          />
        </div>

        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          Mostrando <strong>{filteredBooks.length}</strong> de <strong>{errorBooks.length}</strong> errores
        </div>
      </div>

      {/* List of Error Books */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "5rem 0", color: "var(--text-secondary)" }}>
          <div style={{ width: "32px", height: "32px", border: "3px solid rgba(244,63,94,0.2)", borderTopColor: "#fb7185", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 1rem" }} />
          <p>Cargando lista de errores...</p>
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: "4rem 2rem" }}>
          <div style={{
            width: "52px",
            height: "52px",
            borderRadius: "50%",
            background: "rgba(16, 185, 129, 0.15)",
            color: "var(--accent-emerald)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.25rem"
          }}>
            <Check size={28} />
          </div>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>
            No hay libros en esta categoría de error
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", maxWidth: "420px", margin: "0 auto" }}>
            Todos los demás libros de tu colección han sido clasificados e indexados con éxito.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {filteredBooks.map((book, idx) => {
            const cat = getErrorCategory(book.error);
            const isCopied = copiedId === book.id;

            return (
              <div
                key={book.id}
                className="panel"
                style={{
                  padding: "1.5rem",
                  marginBottom: 0,
                  borderLeft: `4px solid ${cat.color}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.1rem"
                }}
              >
                {/* Header row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                  <div style={{ flex: 1, minWidth: "260px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 700 }}>#{idx + 1}</span>
                      <span
                        className="pill-tag"
                        style={{
                          background: cat.bg,
                          color: cat.color,
                          borderColor: `${cat.color}40`,
                          fontSize: "0.75rem",
                          fontWeight: 700,
                        }}
                      >
                        {cat.label}
                      </span>
                      {book.year && <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>({book.year})</span>}
                    </div>

                    <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#fff", marginBottom: "0.2rem" }}>
                      {book.title}
                    </h3>
                    <p style={{ fontSize: "0.9rem", color: "#a5b4fc", fontWeight: 600 }}>
                      {book.author && book.author !== "Desconocido" ? book.author : "Autor no identificado"}
                    </p>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      onClick={() => handleRevealFinder(book.id)}
                      className="btn btn-sm btn-secondary"
                      title="Mostrar este archivo en Finder de macOS"
                    >
                      <FolderOpen size={14} />
                      <span>Mostrar en Finder</span>
                    </button>

                    <a
                      href={`/api/books/${encodeURIComponent(book.id)}/download`}
                      download
                      className="btn btn-sm btn-secondary"
                      style={{ textDecoration: "none" }}
                      title="Descargar una copia para inspeccionarlo"
                    >
                      <Download size={14} />
                      <span>Descargar</span>
                    </a>

                    <button
                      onClick={() => onSelectBook(book)}
                      className="btn btn-sm btn-secondary"
                      title="Ver ficha técnica"
                    >
                      <BookOpen size={14} />
                      <span>Ver Ficha</span>
                    </button>
                  </div>
                </div>

                {/* Error diagnostics box */}
                <div style={{
                  padding: "1rem 1.25rem",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(244, 63, 94, 0.25)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.4rem"
                }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#fb7185", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <ShieldAlert size={14} />
                    <span>Diagnóstico de Fallo:</span>
                  </div>
                  <pre style={{
                    fontFamily: "monospace",
                    fontSize: "0.84rem",
                    color: "#fecdd3",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    lineHeight: 1.5,
                    margin: 0,
                  }}>
                    {book.error || "Error desconocido durante la extracción o clasificación"}
                  </pre>
                </div>

                {/* Path info with copy button */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.82rem",
                  color: "var(--text-muted)",
                  background: "rgba(255, 255, 255, 0.02)",
                  padding: "0.6rem 0.9rem",
                  borderRadius: "var(--radius-sm)",
                  gap: "1rem",
                }}>
                  <div style={{ fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {book.id}
                  </div>
                  <button
                    onClick={() => handleCopy(book.id, book.id)}
                    className="btn btn-sm btn-secondary"
                    style={{ padding: "0.25rem 0.6rem", fontSize: "0.74rem", flexShrink: 0 }}
                    title="Copiar ruta absoluta"
                  >
                    {isCopied ? (
                      <>
                        <Check size={12} style={{ color: "var(--accent-emerald)" }} />
                        <span style={{ color: "var(--accent-emerald)" }}>Copiada</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copiar ruta</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
