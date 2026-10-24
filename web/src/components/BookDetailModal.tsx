"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Layers,
  Copy,
  Check,
  ShieldCheck,
  BookOpen,
  Download,
  FolderOpen,
  Mail,
  Share2,
} from "lucide-react";
import { BookDetail } from "@/lib/db";

interface BookDetailModalProps {
  book: BookDetail | null;
  onClose: () => void;
}

export function BookDetailModal({ book, onClose }: BookDetailModalProps) {
  const [fullDetail, setFullDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "chunks" | "metadata">("summary");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openingApp, setOpeningApp] = useState(false);
  const [openStatus, setOpenStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!book) return;
    setLoading(true);
    fetch(`/api/books/${encodeURIComponent(book.id)}`)
      .then((res) => res.json())
      .then((data) => {
        setFullDetail(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [book]);

  if (!book) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenBook = async (reveal: boolean = false) => {
    if (!book) return;
    setOpeningApp(true);
    try {
      const res = await fetch(`/api/books/${encodeURIComponent(book.id)}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reveal }),
      });
      const data = await res.json();
      if (data.success) {
        setOpenStatus(reveal ? "Mostrado en Finder" : "Abierto en lector");
        setTimeout(() => setOpenStatus(null), 3500);
      } else {
        // Fallback: descargar si la apertura nativa falla
        window.open(`/api/books/${encodeURIComponent(book.id)}/download`, "_blank");
      }
    } catch {
      window.open(`/api/books/${encodeURIComponent(book.id)}/download`, "_blank");
    } finally {
      setOpeningApp(false);
    }
  };

  const [sharingEmail, setSharingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  const handleShareEmail = async () => {
    if (!book) return;
    setSharingEmail(true);
    try {
      const res = await fetch(`/api/books/${encodeURIComponent(book.id)}/email`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setEmailStatus("Borrador creado en Mail con el EPUB adjunto");
        setTimeout(() => setEmailStatus(null), 4000);
      } else {
        // Fallback: descargar borrador .eml
        window.open(`/api/books/${encodeURIComponent(book.id)}/email`, "_blank");
        setEmailStatus("Borrador descargado con el archivo adjunto");
        setTimeout(() => setEmailStatus(null), 4000);
      }
    } catch {
      window.open(`/api/books/${encodeURIComponent(book.id)}/email`, "_blank");
      setEmailStatus("Borrador descargado con el archivo adjunto");
      setTimeout(() => setEmailStatus(null), 4000);
    } finally {
      setSharingEmail(false);
    }
  };

  const handleShareGmailWeb = () => {
    if (!book) return;
    // Descarga automática del archivo para poder arrastrarlo
    window.open(`/api/books/${encodeURIComponent(book.id)}/download`, "_blank");

    const subject = encodeURIComponent(`Libro EPUB: ${book.title} — ${book.author}`);
    const summaryText = book.summary ? `\n\nResumen:\n${book.summary}` : "";
    const catsText = book.categories?.length ? `\nCategorías: ${book.categories.join(", ")}` : "";
    const yearText = book.year ? `\nAño: ${book.year}` : "";
    const body = encodeURIComponent(
      `Hola,\n\nTe comparto el libro "${book.title}" de ${book.author}.\n\n` +
      `Ficha del libro:` +
      yearText +
      catsText +
      summaryText +
      `\n\n(He descargado el archivo EPUB para adjuntarlo a este correo arrastrándolo)`
    );
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`, "_blank");
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
              <span className="pill-tag">{book.language ? book.language.toUpperCase() : "EPUB"}</span>
              {book.year && <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Publicado en {book.year}</span>}
              {book.metadata_corrected && (
                <span className="pill-tag" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#6ee7b7", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                  <ShieldCheck size={12} />
                  <span>Metadata Validada por IA</span>
                </span>
              )}
            </div>
            <h2 className="modal-title">{book.title}</h2>
            <p className="modal-subtitle">{book.author}</p>
          </div>

          <button onClick={onClose} className="modal-close-btn" title="Cerrar ventana">
            <X size={20} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="modal-tabs">
          <button
            onClick={() => setActiveTab("summary")}
            className={`modal-tab-item ${activeTab === "summary" ? "active" : ""}`}
          >
            Sinopsis & Categorías
          </button>
          <button
            onClick={() => setActiveTab("chunks")}
            className={`modal-tab-item ${activeTab === "chunks" ? "active" : ""}`}
          >
            Fragmentos Indexados ({book.chunk_count})
          </button>
          <button
            onClick={() => setActiveTab("metadata")}
            className={`modal-tab-item ${activeTab === "metadata" ? "active" : ""}`}
          >
            Validación de Metadatos OPF
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {activeTab === "summary" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
              {/* Executive Summary */}
              <div>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: "0.6rem" }}>
                  Resumen Ejecutivo (Estrategia "Resumen de Resúmenes")
                </div>
                <div style={{ padding: "1.25rem 1.5rem", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)", fontSize: "0.95rem", lineHeight: 1.65, color: "#e2e8f0" }}>
                  {book.summary || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Sin resumen disponible para este libro.</span>}
                </div>
              </div>

              {/* Categories */}
              <div>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: "0.6rem" }}>
                  Categorías Temáticas Asignadas
                </div>
                <div className="tags-row">
                  {book.categories.map((c) => (
                    <span key={c} className="category-tag" style={{ fontSize: "0.82rem", padding: "0.35rem 0.8rem" }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Keywords */}
              {book.keywords && book.keywords.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: "0.6rem" }}>
                    Conceptos & Palabras Clave
                  </div>
                  <div className="tags-row">
                    {book.keywords.map((kw) => (
                      <span key={kw} style={{ fontSize: "0.78rem", padding: "0.3rem 0.65rem", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", color: "var(--text-secondary)" }}>
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Cluster Group info */}
              {book.cluster_label && (
                <div style={{ padding: "1.2rem 1.5rem", borderRadius: "var(--radius-md)", background: "rgba(6, 182, 212, 0.1)", border: "1px solid rgba(6, 182, 212, 0.25)", fontSize: "0.85rem" }}>
                  <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4rem", color: "#67e8f9", marginBottom: "0.25rem" }}>
                    <Layers size={16} />
                    <span>Grupo Temático Descubierto por Clustering:</span>
                  </div>
                  <p style={{ color: "#e2e8f0" }}>{book.cluster_label}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "chunks" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                <span>Muestra de fragmentos indexados en ChromaDB:</span>
                <span>Total: {book.chunk_count} chunks</span>
              </div>

              {loading ? (
                <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-muted)" }}>Cargando fragmentos...</div>
              ) : fullDetail?.sample_chunks?.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {fullDetail.sample_chunks.map((ch: any) => (
                    <div
                      key={ch.id}
                      style={{ padding: "1.25rem", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.025)", border: "1px solid var(--border-subtle)" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#a5b4fc" }}>{ch.chapter}</span>
                        <button
                          onClick={() => handleCopy(ch.content, ch.id)}
                          className="btn btn-sm btn-secondary"
                          style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                        >
                          {copiedId === ch.id ? (
                            <>
                              <Check size={13} color="var(--accent-emerald)" />
                              <span style={{ color: "var(--accent-emerald)" }}>Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy size={13} />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p style={{ fontSize: "0.85rem", color: "#cbd5e1", lineHeight: 1.6, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                        {ch.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-muted)" }}>
                  No hay fragmentos disponibles para este libro.
                </div>
              )}
            </div>
          )}

          {activeTab === "metadata" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)" }}>
                Comparativa: Metadatos Originales (.opf) vs IA
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem" }}>
                <div style={{ padding: "1.2rem", borderRadius: "var(--radius-md)", background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: "0.3rem" }}>
                    Título en archivo (.opf)
                  </div>
                  <div style={{ fontSize: "0.95rem", color: "var(--text-main)", fontWeight: 600 }}>{book.original_title || book.title}</div>
                </div>

                <div style={{ padding: "1.2rem", borderRadius: "var(--radius-md)", background: "rgba(99, 102, 241, 0.12)", border: "1px solid rgba(99, 102, 241, 0.3)" }}>
                  <div style={{ fontSize: "0.72rem", color: "#a5b4fc", fontWeight: 700, textTransform: "uppercase", marginBottom: "0.3rem" }}>
                    Título Validado por IA
                  </div>
                  <div style={{ fontSize: "0.95rem", color: "#fff", fontWeight: 700 }}>{book.title}</div>
                </div>

                <div style={{ padding: "1.2rem", borderRadius: "var(--radius-md)", background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: "0.3rem" }}>
                    Autor en archivo (.opf)
                  </div>
                  <div style={{ fontSize: "0.95rem", color: "var(--text-main)", fontWeight: 600 }}>{book.original_author || book.author}</div>
                </div>

                <div style={{ padding: "1.2rem", borderRadius: "var(--radius-md)", background: "rgba(99, 102, 241, 0.12)", border: "1px solid rgba(99, 102, 241, 0.3)" }}>
                  <div style={{ fontSize: "0.72rem", color: "#a5b4fc", fontWeight: 700, textTransform: "uppercase", marginBottom: "0.3rem" }}>
                    Autor Validado por IA
                  </div>
                  <div style={{ fontSize: "0.95rem", color: "#fff", fontWeight: 700 }}>{book.author}</div>
                </div>
              </div>

              {/* Panel de Ubicación Local y Botones de Acceso & Compartir */}
              <div style={{
                padding: "1.5rem 1.8rem",
                borderRadius: "var(--radius-lg)",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--border-medium)",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem"
              }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <FolderOpen size={15} style={{ color: "var(--accent-cyan)" }} />
                      <span>Ruta local del archivo:</span>
                    </span>
                    <button
                      onClick={() => handleCopy(book.id, "filepath")}
                      className="btn btn-sm btn-secondary"
                      style={{ padding: "0.35rem 0.8rem", fontSize: "0.78rem" }}
                      title="Copiar ruta al portapapeles"
                    >
                      {copiedId === "filepath" ? (
                        <>
                          <Check size={13} style={{ color: "var(--accent-emerald)" }} />
                          <span style={{ color: "var(--accent-emerald)" }}>Ruta copiada</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copiar ruta</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Path box */}
                  <div style={{
                    padding: "0.85rem 1.15rem",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(0, 0, 0, 0.45)",
                    border: "1px solid var(--border-subtle)",
                    fontFamily: "monospace",
                    fontSize: "0.86rem",
                    color: "#f1f5f9",
                    wordBreak: "break-all",
                    lineHeight: 1.5
                  }}>
                    {book.id}
                  </div>
                </div>

                {/* Botones para acceder al libro y compartir por email */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.85rem", alignItems: "center" }}>
                  {/* Abrir en lector del sistema (macOS open) */}
                  <button
                    onClick={() => handleOpenBook(false)}
                    disabled={openingApp}
                    className="btn btn-primary"
                    style={{ padding: "0.75rem 1.4rem", fontSize: "0.88rem" }}
                    title="Abrir el libro con la aplicación predeterminada del sistema (Apple Books, etc.)"
                  >
                    <BookOpen size={16} />
                    <span>Abrir Libro</span>
                  </button>

                  {/* Descargar archivo EPUB */}
                  <a
                    href={`/api/books/${encodeURIComponent(book.id)}/download`}
                    download
                    className="btn btn-secondary"
                    style={{ padding: "0.75rem 1.4rem", fontSize: "0.88rem", textDecoration: "none" }}
                    title="Descargar una copia del archivo EPUB"
                  >
                    <Download size={16} />
                    <span>Descargar EPUB</span>
                  </a>

                  {/* Mostrar en Finder */}
                  <button
                    onClick={() => handleOpenBook(true)}
                    disabled={openingApp}
                    className="btn btn-secondary"
                    style={{ padding: "0.75rem 1.3rem", fontSize: "0.88rem" }}
                    title="Revelar y seleccionar el archivo en Finder de macOS"
                  >
                    <FolderOpen size={16} />
                    <span>Mostrar en Finder</span>
                  </button>

                  {/* Compartir por Email con archivo adjunto */}
                  <button
                    onClick={handleShareEmail}
                    disabled={sharingEmail}
                    className="btn btn-secondary"
                    style={{
                      padding: "0.75rem 1.4rem",
                      fontSize: "0.88rem",
                      background: "rgba(99, 102, 241, 0.16)",
                      borderColor: "rgba(99, 102, 241, 0.45)",
                      color: "#c7d2fe",
                    }}
                    title="Abre un borrador en Mail con el archivo EPUB adjunto"
                  >
                    {sharingEmail ? (
                      <>
                        <div style={{ width: "15px", height: "15px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                        <span>Adjuntando...</span>
                      </>
                    ) : (
                      <>
                        <Mail size={16} style={{ color: "var(--accent-primary)" }} />
                        <span>Email con EPUB adjunto</span>
                      </>
                    )}
                  </button>

                  {/* Alternativa Gmail Web */}
                  <button
                    onClick={handleShareGmailWeb}
                    className="btn btn-secondary"
                    style={{
                      padding: "0.75rem 1.15rem",
                      fontSize: "0.82rem",
                      background: "rgba(255, 255, 255, 0.04)",
                    }}
                    title="Abre Gmail en el navegador y descarga el EPUB para que puedas arrastrarlo"
                  >
                    <span>Abrir en Gmail Web</span>
                  </button>

                  {/* Descargar borrador .eml */}
                  <a
                    href={`/api/books/${encodeURIComponent(book.id)}/email`}
                    download
                    className="btn btn-secondary"
                    style={{
                      padding: "0.75rem 1rem",
                      fontSize: "0.82rem",
                      background: "rgba(255, 255, 255, 0.04)",
                      textDecoration: "none",
                    }}
                    title="Descargar archivo .eml con el EPUB adjunto"
                  >
                    <span>Descargar .eml</span>
                  </a>

                  {emailStatus && (
                    <span className="pill-tag" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#6ee7b7", padding: "0.45rem 0.9rem" }}>
                      <Check size={14} />
                      <span>{emailStatus}</span>
                    </span>
                  )}
                </div>

                {/* Hash & Date info */}
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  <div>
                    <span>Hash SHA-256: </span>
                    <span style={{ fontFamily: "monospace", color: "#94a3b8" }}>{book.sha256}</span>
                  </div>
                  <div>
                    <span>Fecha de procesamiento: </span>
                    <span style={{ color: "#cbd5e1" }}>{new Date(book.processed_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Persistent Footer for Quick Access on Any Tab */}
        <div className="modal-footer">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              onClick={() => handleOpenBook(false)}
              disabled={openingApp}
              className="btn btn-primary btn-sm"
              style={{ padding: "0.6rem 1.2rem" }}
              title="Abrir el libro con la aplicación predeterminada del sistema"
            >
              <BookOpen size={15} />
              <span>Acceder al Libro</span>
            </button>
            <a
              href={`/api/books/${encodeURIComponent(book.id)}/download`}
              download
              className="btn btn-secondary btn-sm"
              style={{ padding: "0.6rem 1.2rem", textDecoration: "none" }}
              title="Descargar archivo EPUB"
            >
              <Download size={15} />
              <span>Descargar</span>
            </a>
            <button
              onClick={handleShareEmail}
              disabled={sharingEmail}
              className="btn btn-secondary btn-sm"
              style={{ padding: "0.6rem 1.2rem" }}
              title="Abre un borrador en Mail con el archivo EPUB adjunto"
            >
              {sharingEmail ? (
                <>
                  <div style={{ width: "13px", height: "13px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                  <span>Adjuntando...</span>
                </>
              ) : (
                <>
                  <Mail size={15} />
                  <span>Email con adjunto</span>
                </>
              )}
            </button>
          </div>

          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: "0.6rem 1.2rem" }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
