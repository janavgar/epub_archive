"use client";

import React, { useState, useEffect } from "react";
import {
  Copy,
  Check,
  Trash2,
  FolderOpen,
  BookOpen,
  Search,
  RefreshCw,
  AlertCircle,
  FileCheck2,
  Layers,
  Sparkles,
  HardDrive,
  Database,
  ExternalLink,
} from "lucide-react";
import { BookDetail } from "@/lib/db";
import { DeleteBookModal } from "./DeleteBookModal";

interface DuplicateBookItem extends BookDetail {
  file_exists: boolean;
  file_size_bytes?: number;
  file_size_formatted?: string;
  filename: string;
}

interface DuplicateGroup {
  key: string;
  type: "sha256" | "title_author";
  title: string;
  author: string;
  count: number;
  books: DuplicateBookItem[];
}

interface DuplicatesViewProps {
  onSelectBook: (book: BookDetail) => void;
  onRefreshStats?: () => void;
}

export function DuplicatesView({ onSelectBook, onRefreshStats }: DuplicatesViewProps) {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [summary, setSummary] = useState<{
    totalGroups: number;
    totalDuplicateBooks: number;
    sha256Groups: number;
    titleAuthorGroups: number;
  }>({
    totalGroups: 0,
    totalDuplicateBooks: 0,
    sha256Groups: 0,
    titleAuthorGroups: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "sha256" | "title_author">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Deletion modal state
  const [bookToDelete, setBookToDelete] = useState<{
    id: string;
    title: string;
    author: string;
  } | null>(null);
  const [deleteWithFile, setDeleteWithFile] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchDuplicates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab !== "all") params.set("type", activeTab);
      if (searchTerm.trim()) params.set("search", searchTerm.trim());

      const res = await fetch(`/api/books/duplicates?${params.toString()}`);
      const data = await res.json();
      if (data && data.groups) {
        setGroups(data.groups);
        setSummary(data.summary);
      }
    } catch (err) {
      console.error("Error al cargar duplicados:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDuplicates();
  }, [activeTab, searchTerm]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenFolder = async (bookId: string) => {
    try {
      await fetch(`/api/books/${encodeURIComponent(bookId)}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reveal: true }),
      });
    } catch {
      // Ignorar error si no está soportado
    }
  };

  const promptDelete = (book: DuplicateBookItem, withFile: boolean) => {
    setBookToDelete({
      id: book.id,
      title: book.title,
      author: book.author,
    });
    setDeleteWithFile(withFile);
    setDeleteModalOpen(true);
  };

  const handleDeleted = (bookId: string, fileDeleted: boolean) => {
    setNotification({
      message: fileDeleted
        ? "Copia eliminada de la base de datos y archivo físico borrado del disco."
        : "Registro eliminado de la base de datos.",
      type: "success",
    });
    setTimeout(() => setNotification(null), 4500);

    // Actualizar lista local de grupos
    setGroups((prev) =>
      prev
        .map((g) => ({
          ...g,
          books: g.books.filter((b) => b.id !== bookId),
          count: g.books.filter((b) => b.id !== bookId).length,
        }))
        .filter((g) => g.books.length > 1) // Ocultar grupos que ya solo tienen 1 libro
    );

    if (onRefreshStats) onRefreshStats();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Toast Notification */}
      {notification && (
        <div
          style={{
            position: "fixed",
            bottom: "2rem",
            right: "2rem",
            zIndex: 99999,
            padding: "1rem 1.4rem",
            borderRadius: "var(--radius-md)",
            background: "rgba(16, 185, 129, 0.95)",
            color: "#fff",
            fontWeight: 600,
            fontSize: "0.9rem",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            animation: "fadeIn 0.3s ease",
          }}
        >
          <Check size={18} />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header and Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", marginBottom: "0.3rem" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", margin: 0 }}>
              Gestión de Duplicados
            </h1>
            <span
              className="pill-tag"
              style={{
                fontSize: "0.78rem",
                background: "rgba(244, 63, 94, 0.15)",
                borderColor: "rgba(244, 63, 94, 0.35)",
                color: "#fda4af",
              }}
            >
              {summary.totalGroups} grupos detectados
            </span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", margin: 0 }}>
            Identifica y elimina copias redundantes tanto de la base de datos como de tu almacenamiento local
          </p>
        </div>

        <button
          onClick={fetchDuplicates}
          disabled={loading}
          className="btn btn-secondary btn-sm"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
          title="Recalcular duplicados"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          <span>Actualizar Lista</span>
        </button>
      </div>

      {/* Summary Metric Cards */}
      <div className="dashboard-grid">
        <div className="panel stat-card" style={{ borderLeft: "3px solid #f43f5e" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
            <span className="stat-label">Grupos Duplicados</span>
            <Layers size={18} style={{ color: "#f43f5e" }} />
          </div>
          <div className="stat-value" style={{ color: "#fda4af" }}>{summary.totalGroups}</div>
          <p className="stat-subtext">Colecciones de títulos repetidos</p>
        </div>

        <div className="panel stat-card" style={{ borderLeft: "3px solid #fb7185" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
            <span className="stat-label">Libros Implicados</span>
            <AlertCircle size={18} style={{ color: "#fb7185" }} />
          </div>
          <div className="stat-value">{summary.totalDuplicateBooks}</div>
          <p className="stat-subtext">Copias ocupando catálogo y disco</p>
        </div>

        <div className="panel stat-card" style={{ borderLeft: "3px solid #38bdf8" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
            <span className="stat-label">Duplicados Exactos</span>
            <Sparkles size={18} style={{ color: "#38bdf8" }} />
          </div>
          <div className="stat-value" style={{ color: "#7dd3fc" }}>{summary.sha256Groups}</div>
          <p className="stat-subtext">Mismo Hash SHA-256 (ficheros 100% idénticos)</p>
        </div>

        <div className="panel stat-card" style={{ borderLeft: "3px solid #818cf8" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
            <span className="stat-label">Mismo Título y Autor</span>
            <FileCheck2 size={18} style={{ color: "#818cf8" }} />
          </div>
          <div className="stat-value" style={{ color: "#a5b4fc" }}>{summary.titleAuthorGroups}</div>
          <p className="stat-subtext">Ediciones o archivos con nombres diferentes</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="panel"
        style={{
          padding: "1rem 1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            onClick={() => setActiveTab("all")}
            className={`btn btn-sm ${activeTab === "all" ? "btn-primary" : "btn-secondary"}`}
          >
            Todos ({summary.totalGroups})
          </button>
          <button
            onClick={() => setActiveTab("sha256")}
            className={`btn btn-sm ${activeTab === "sha256" ? "btn-primary" : "btn-secondary"}`}
          >
            Mismo Hash SHA-256 ({summary.sha256Groups})
          </button>
          <button
            onClick={() => setActiveTab("title_author")}
            className={`btn btn-sm ${activeTab === "title_author" ? "btn-primary" : "btn-secondary"}`}
          >
            Mismo Título y Autor ({summary.titleAuthorGroups})
          </button>
        </div>

        <div style={{ position: "relative", minWidth: "260px" }}>
          <Search
            size={16}
            style={{ position: "absolute", left: "0.9rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
          />
          <input
            type="text"
            placeholder="Buscar por título o autor en duplicados..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field"
            style={{ paddingLeft: "2.4rem", fontSize: "0.86rem", width: "100%" }}
          />
        </div>
      </div>

      {/* Duplicate Groups List */}
      {loading ? (
        <div style={{ padding: "4rem 0", textAlign: "center", color: "var(--text-muted)" }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: "0 auto 1rem", opacity: 0.6 }} />
          <p>Analizando catálogo y agrupando libros duplicados...</p>
        </div>
      ) : groups.length === 0 ? (
        <div
          className="panel"
          style={{
            padding: "4rem 2rem",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "rgba(16, 185, 129, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#34d399",
            }}
          >
            <Check size={28} />
          </div>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff", margin: 0 }}>
            {searchTerm
              ? "No se encontraron duplicados con ese término de búsqueda."
              : "¡No se han encontrado libros duplicados!"}
          </h3>
          <p style={{ color: "var(--text-secondary)", maxWidth: "450px", fontSize: "0.9rem", margin: 0 }}>
            Tu archivo está limpio y libre de redundancias para el criterio seleccionado.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {groups.map((group, groupIdx) => {
            const isExactSha = group.type === "sha256";

            return (
              <div
                key={group.key}
                className="panel"
                style={{
                  padding: "1.5rem",
                  borderColor: isExactSha ? "rgba(56, 189, 248, 0.3)" : "rgba(129, 140, 248, 0.25)",
                  background: isExactSha ? "rgba(15, 23, 42, 0.75)" : "rgba(255, 255, 255, 0.02)",
                }}
              >
                {/* Group Header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "1rem",
                    paddingBottom: "1.1rem",
                    marginBottom: "1.2rem",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 700 }}>
                        #{groupIdx + 1}
                      </span>
                      <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#fff", margin: 0 }}>
                        {group.title}
                      </h3>
                      <span
                        className="pill-tag"
                        style={{
                          fontSize: "0.72rem",
                          background: isExactSha ? "rgba(56, 189, 248, 0.15)" : "rgba(129, 140, 248, 0.15)",
                          color: isExactSha ? "#7dd3fc" : "#a5b4fc",
                          borderColor: isExactSha ? "rgba(56, 189, 248, 0.35)" : "rgba(129, 140, 248, 0.35)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.3rem",
                        }}
                      >
                        {isExactSha ? <Sparkles size={12} /> : <Layers size={12} />}
                        <span>{isExactSha ? "Hash SHA-256 Idéntico" : "Mismo Título y Autor"}</span>
                      </span>
                      <span className="pill-tag" style={{ fontSize: "0.72rem" }}>
                        {group.count} copias
                      </span>
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "#cbd5e1" }}>
                      Autor: <strong style={{ color: "#fff" }}>{group.author}</strong>
                    </div>
                  </div>
                </div>

                {/* Copies List */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  {group.books.map((book, copyIdx) => (
                    <div
                      key={book.id}
                      style={{
                        padding: "1rem 1.25rem",
                        borderRadius: "var(--radius-md)",
                        background: "rgba(0, 0, 0, 0.25)",
                        border: "1px solid var(--border-subtle)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "1.25rem",
                      }}
                    >
                      {/* Left File Info */}
                      <div style={{ flex: 1, minWidth: "280px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              padding: "0.15rem 0.5rem",
                              borderRadius: "4px",
                              background: "rgba(255, 255, 255, 0.08)",
                              color: "#fff",
                            }}
                          >
                            Copia #{copyIdx + 1}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#f8fafc" }}>
                            {book.filename}
                          </span>
                          {book.file_exists ? (
                            <span
                              className="pill-tag"
                              style={{
                                fontSize: "0.7rem",
                                background: "rgba(16, 185, 129, 0.15)",
                                color: "#6ee7b7",
                                borderColor: "rgba(16, 185, 129, 0.35)",
                              }}
                            >
                              En disco ({book.file_size_formatted || "OK"})
                            </span>
                          ) : (
                            <span
                              className="pill-tag"
                              style={{
                                fontSize: "0.7rem",
                                background: "rgba(244, 63, 94, 0.15)",
                                color: "#fda4af",
                                borderColor: "rgba(244, 63, 94, 0.35)",
                              }}
                            >
                              Fichero no encontrado
                            </span>
                          )}
                          {book.status === "error" && (
                            <span
                              className="pill-tag"
                              style={{
                                fontSize: "0.7rem",
                                background: "rgba(244, 63, 94, 0.15)",
                                color: "#fda4af",
                              }}
                            >
                              Error en proceso
                            </span>
                          )}
                          {book.is_read && (
                            <span
                              className="pill-tag"
                              style={{
                                fontSize: "0.7rem",
                                background: "rgba(16, 185, 129, 0.15)",
                                color: "#6ee7b7",
                              }}
                            >
                              Leído
                            </span>
                          )}
                        </div>

                        {/* File path row */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.4rem",
                            fontSize: "0.76rem",
                            fontFamily: "monospace",
                            color: "var(--text-secondary)",
                            wordBreak: "break-all",
                          }}
                        >
                          <span style={{ color: "var(--text-muted)" }}>Ruta:</span>
                          <span>{book.id}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(book.id, book.id)}
                            style={{
                              background: "none",
                              border: "none",
                              color: copiedId === book.id ? "#34d399" : "var(--text-muted)",
                              cursor: "pointer",
                              padding: "0 0.2rem",
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                            title="Copiar ruta"
                          >
                            {copiedId === book.id ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>

                        <div style={{ display: "flex", gap: "1rem", marginTop: "0.35rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                          <span>{book.chunk_count} chunks vectorizados</span>
                          {book.year && <span>Año: {book.year}</span>}
                          {book.processed_at && (
                            <span>Procesado: {new Date(book.processed_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>

                      {/* Right Action Buttons */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => onSelectBook(book)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: "0.4rem 0.8rem", fontSize: "0.78rem" }}
                          title="Ver ficha completa y fragmentos"
                        >
                          <BookOpen size={14} />
                          <span>Ficha</span>
                        </button>

                        {book.file_exists && (
                          <button
                            type="button"
                            onClick={() => handleOpenFolder(book.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "0.4rem 0.8rem", fontSize: "0.78rem" }}
                            title="Mostrar archivo en el Finder de macOS"
                          >
                            <FolderOpen size={14} />
                            <span>En Finder</span>
                          </button>
                        )}

                        {/* Delete DB only */}
                        <button
                          type="button"
                          onClick={() => promptDelete(book, false)}
                          className="btn btn-secondary btn-sm"
                          style={{
                            padding: "0.4rem 0.8rem",
                            fontSize: "0.78rem",
                            borderColor: "rgba(255, 255, 255, 0.12)",
                          }}
                          title="Elimina solo el registro de SQLite y ChromaDB; conserva el archivo"
                        >
                          <Database size={13} style={{ color: "#818cf8" }} />
                          <span>Borrar solo BD</span>
                        </button>

                        {/* Delete DB + Physical File */}
                        <button
                          type="button"
                          onClick={() => promptDelete(book, true)}
                          className="btn btn-danger btn-sm"
                          style={{
                            padding: "0.4rem 0.85rem",
                            fontSize: "0.78rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            fontWeight: 700,
                          }}
                          title="Elimina esta copia duplicada de la base de datos Y de tu disco"
                        >
                          <Trash2 size={13} />
                          <span>Eliminar de BD y Disco</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteBookModal
        isOpen={deleteModalOpen}
        book={bookToDelete}
        onClose={() => {
          setDeleteModalOpen(false);
          setBookToDelete(null);
        }}
        onDeleted={handleDeleted}
        initialDeleteFile={deleteWithFile}
      />
    </div>
  );
}
