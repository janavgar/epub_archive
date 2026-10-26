"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Grid3X3,
  List,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  BookCheck,
  PlusCircle,
  Trash2,
  Copy,
  X,
} from "lucide-react";
import { BookDetail } from "@/lib/db";
import { ManualBookModal } from "./ManualBookModal";
import { DeleteBookModal } from "./DeleteBookModal";

interface BooksViewProps {
  onSelectBook: (book: BookDetail) => void;
  onBookUpdated?: (book: BookDetail) => void;
  onNavigateDuplicates?: () => void;
  initialCategory?: string;
  initialReadFilter?: string;
}

export function BooksView({
  onSelectBook,
  onBookUpdated,
  onNavigateDuplicates,
  initialCategory,
  initialReadFilter,
}: BooksViewProps) {
  const [books, setBooks] = useState<BookDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || "");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [readFilter, setReadFilter] = useState<string>(initialReadFilter || "");
  const [updatingBookId, setUpdatingBookId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [totalCount, setTotalCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 36;

  const [categories, setCategories] = useState<string[]>([]);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BookDetail | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data.topCategories) {
          setCategories(data.topCategories.map((c: any) => c.name));
        }
        if (typeof data.duplicateGroups === "number") {
          setDuplicateCount(data.duplicateGroups);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (initialCategory !== undefined) {
      setSelectedCategory(initialCategory);
      setPage(1);
    }
  }, [initialCategory]);

  useEffect(() => {
    if (initialReadFilter !== undefined) {
      setReadFilter(initialReadFilter);
      setPage(1);
    }
  }, [initialReadFilter]);

  const loadBooks = async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * pageSize;
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });

      if (search.trim()) params.set("search", search.trim());
      if (selectedCategory) params.set("category", selectedCategory);
      if (selectedStatus) params.set("status", selectedStatus);
      if (readFilter === "read") params.set("read", "true");
      if (readFilter === "unread") params.set("read", "false");

      const res = await fetch(`/api/books?${params.toString()}`);
      const data = await res.json();
      setBooks(data.books || []);
      setTotalCount(data.total || 0);
    } catch {
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooks();
  }, [page, search, selectedCategory, selectedStatus, readFilter]);

  const handleToggleRead = async (e: React.MouseEvent, book: BookDetail) => {
    e.stopPropagation();
    setUpdatingBookId(book.id);
    try {
      const res = await fetch("/api/books/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: book.id, is_read: !book.is_read }),
      });
      if (res.ok) {
        const updated = await res.json();
        setBooks((prev) =>
          prev.map((b) =>
            b.id === book.id ? { ...b, is_read: updated.is_read, read_at: updated.read_at } : b
          )
        );
        if (onBookUpdated) onBookUpdated(updated);
      }
    } catch (err) {
      console.error("Error al actualizar estado de lectura:", err);
    } finally {
      setUpdatingBookId(null);
    }
  };

  const getCoverGradient = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h1 = Math.abs(hash % 360);
    const h2 = (h1 + 45) % 360;
    return `linear-gradient(135deg, hsl(${h1}, 70%, 25%) 0%, hsl(${h2}, 80%, 15%) 100%)`;
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Top Header & Search Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", marginBottom: "0.3rem", flexWrap: "wrap" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
              Catálogo Bibliográfico
            </h1>
            <span className="pill-tag" style={{ fontSize: "0.75rem" }}>
              {totalCount} libros
            </span>
            {readFilter === "read" && (
              <span
                className="pill-tag"
                style={{
                  fontSize: "0.75rem",
                  background: "rgba(16, 185, 129, 0.2)",
                  color: "#34d399",
                  borderColor: "rgba(16, 185, 129, 0.4)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  fontWeight: 600,
                }}
              >
                <BookCheck size={12} />
                <span>Solo Leídos</span>
              </span>
            )}
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            {readFilter === "read"
              ? "Mostrando los libros que tienen el marcador de 'Leído'"
              : "Explora metadatos validados, fragmentos vectorizados y resúmenes ejecutivos"}
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          {onNavigateDuplicates && duplicateCount > 0 && (
            <button
              onClick={onNavigateDuplicates}
              className="btn btn-secondary"
              style={{
                fontSize: "0.86rem",
                borderColor: "rgba(244, 63, 94, 0.4)",
                color: "#fda4af",
                background: "rgba(244, 63, 94, 0.1)",
              }}
              title="Detectar y eliminar libros duplicados"
            >
              <Copy size={15} style={{ color: "#f43f5e" }} />
              <span>Duplicados ({duplicateCount})</span>
            </button>
          )}

          <button
            onClick={() => setManualModalOpen(true)}
            className="btn btn-primary"
            style={{ fontSize: "0.86rem" }}
            title="Añadir libro manualmente al catálogo"
          >
            <PlusCircle size={15} />
            <span>+ Añadir Manualmente</span>
          </button>

          {/* View mode toggle with clear spacing */}
          <div style={{ display: "flex", gap: "0.5rem", background: "rgba(255,255,255,0.04)", padding: "0.3rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
            <button
              onClick={() => setViewMode("grid")}
              className={`btn btn-sm ${viewMode === "grid" ? "btn-primary" : "btn-secondary"}`}
              title="Vista en cuadrícula"
            >
              <Grid3X3 size={16} />
              <span>Cuadrícula</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`btn btn-sm ${viewMode === "list" ? "btn-primary" : "btn-secondary"}`}
              title="Vista en lista"
            >
              <List size={16} />
              <span>Lista</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar Panel with generous margins */}
      <div className="panel" style={{ padding: "1.5rem", display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
        {/* Search input */}
        <div style={{ flex: 1, minWidth: "280px", position: "relative" }}>
          <Search size={18} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por título, autor, palabras clave o sinopsis..."
            className="form-input"
            style={{ paddingLeft: "2.8rem" }}
          />
        </div>

        {/* Category filter */}
        <div style={{ width: "240px" }}>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="form-select"
          >
            <option value="">Todas las categorías</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div style={{ width: "190px" }}>
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="form-select"
          >
            <option value="">Todos los estados</option>
            <option value="done">Listos (exitosos)</option>
            <option value="error">Con errores</option>
          </select>
        </div>

        {/* Read status filter */}
        <div style={{ width: "190px" }}>
          <select
            value={readFilter}
            onChange={(e) => {
              setReadFilter(e.target.value);
              setPage(1);
            }}
            className="form-select"
            style={
              readFilter === "read"
                ? {
                    borderColor: "rgba(16, 185, 129, 0.6)",
                    background: "rgba(16, 185, 129, 0.12)",
                    color: "#a7f3d0",
                    fontWeight: 600,
                  }
                : undefined
            }
          >
            <option value="">Lectura: Todos</option>
            <option value="read">Solo Leídos (✓)</option>
            <option value="unread">Solo Pendientes</option>
          </select>
        </div>

        {/* Clear filters button */}
        {(Boolean(search) || Boolean(selectedCategory) || Boolean(selectedStatus) || Boolean(readFilter)) && (
          <button
            onClick={() => {
              setSearch("");
              setSelectedCategory("");
              setSelectedStatus("");
              setReadFilter("");
              setPage(1);
            }}
            className="btn btn-sm btn-secondary"
            style={{ fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.55rem 0.85rem" }}
            title="Restablecer todos los filtros"
          >
            <X size={14} />
            <span>Restablecer filtros</span>
          </button>
        )}
      </div>

      {/* Books Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "6rem 0", color: "var(--text-secondary)" }}>
          <p>Cargando libros de la biblioteca...</p>
        </div>
      ) : books.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: "4rem 2rem" }}>
          <BookOpen size={36} color="var(--accent-primary)" style={{ margin: "0 auto 1rem" }} />
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>
            {readFilter === "read" ? "No se encontraron libros leídos" : "No se encontraron libros"}
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", maxWidth: "440px", margin: "0 auto" }}>
            {readFilter === "read"
              ? "Actualmente no hay libros que coincidan con el filtro de 'Leído'. Puedes marcar libros como leídos usando el botón 'Leído' en cada ficha de libro."
              : "Prueba a modificar los filtros o el texto de búsqueda para encontrar lo que buscas."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="books-grid">
          {books.map((book) => (
            <div
              key={book.id}
              onClick={() => onSelectBook(book)}
              className="book-card"
            >
              <div>
                {/* Styled Aesthetic Book Cover */}
                <div
                  className="book-cover"
                  style={{ background: getCoverGradient(book.title) }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.4rem" }}>
                    <span className="pill-tag" style={{ background: "rgba(0,0,0,0.45)", color: "#fff", borderColor: "rgba(255,255,255,0.2)" }}>
                      {book.language ? book.language.toUpperCase() : "EPUB"}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      {book.is_read && (
                        <span
                          className="pill-tag"
                          style={{
                            background: "rgba(16, 185, 129, 0.25)",
                            color: "#34d399",
                            borderColor: "rgba(16, 185, 129, 0.5)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                          }}
                          title="Libro marcado como leído"
                        >
                          <BookCheck size={11} />
                          <span>Leído</span>
                        </span>
                      )}
                      {book.metadata_corrected && (
                        <span className="pill-tag" style={{ background: "rgba(16, 185, 129, 0.3)", color: "#a7f3d0", borderColor: "rgba(16, 185, 129, 0.5)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          <ShieldCheck size={11} />
                          <span>Validado</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="book-cover-title" style={{ display: "flex", alignItems: "flex-start", gap: "0.45rem" }}>
                    {book.is_read && (
                      <span title="Libro marcado como leído" style={{ display: "inline-flex" }}>
                        <BookCheck
                          size={17}
                          style={{
                            color: "#34d399",
                            flexShrink: 0,
                            marginTop: "2px",
                            filter: "drop-shadow(0 0 6px rgba(52, 211, 153, 0.6))",
                          }}
                        />
                      </span>
                    )}
                    <span>{book.title}</span>
                  </h3>
                </div>

                {/* Body Content */}
                <div className="book-card-body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span className="book-author">{book.author}</span>
                    {book.year && <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{book.year}</span>}
                  </div>

                  {book.summary ? (
                    <p className="book-summary">{book.summary}</p>
                  ) : book.error ? (
                    <p style={{ fontSize: "0.78rem", color: "var(--accent-rose)" }}>{book.error}</p>
                  ) : (
                    <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontStyle: "italic" }}>Sin resumen disponible</p>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="book-card-footer">
                <div className="tags-row">
                  {book.categories.slice(0, 2).map((cat) => (
                    <span key={cat} className="category-tag">{cat}</span>
                  ))}
                  {book.categories.length > 2 && (
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", alignSelf: "center" }}>
                      +{book.categories.length - 2}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <button
                    onClick={(e) => handleToggleRead(e, book)}
                    disabled={updatingBookId === book.id}
                    className="btn btn-sm"
                    style={{
                      padding: "0.22rem 0.55rem",
                      fontSize: "0.72rem",
                      borderRadius: "6px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      background: book.is_read ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.05)",
                      borderColor: book.is_read ? "rgba(16, 185, 129, 0.45)" : "var(--border-subtle)",
                      color: book.is_read ? "#6ee7b7" : "var(--text-muted)",
                    }}
                    title={book.is_read ? "Haz clic para desmarcar como leído" : "Marcar como leído"}
                  >
                    <BookCheck size={12} style={{ color: book.is_read ? "#34d399" : "var(--text-muted)" }} />
                    <span>{book.is_read ? "Leído" : "Leído?"}</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(book);
                      setDeleteModalOpen(true);
                    }}
                    className="btn btn-sm btn-danger"
                    style={{
                      padding: "0.22rem 0.45rem",
                      fontSize: "0.72rem",
                      borderRadius: "6px",
                    }}
                    title="Eliminar este libro"
                  >
                    <Trash2 size={12} />
                  </button>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{book.chunk_count} chunks</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          {books.map((book, idx) => (
            <div
              key={book.id}
              onClick={() => onSelectBook(book)}
              style={{
                padding: "1.25rem 1.75rem",
                borderBottom: idx < books.length - 1 ? "1px solid var(--border-subtle)" : "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1.5rem",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ maxWidth: "650px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                  {book.is_read && (
                    <span title="Libro marcado como leído" style={{ display: "inline-flex" }}>
                      <BookCheck
                        size={18}
                        style={{
                          color: "#34d399",
                          filter: "drop-shadow(0 0 6px rgba(52, 211, 153, 0.5))",
                          flexShrink: 0,
                        }}
                      />
                    </span>
                  )}
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff" }}>{book.title}</h3>
                  {book.is_read && (
                    <span
                      className="pill-tag"
                      style={{
                        background: "rgba(16, 185, 129, 0.18)",
                        color: "#6ee7b7",
                        borderColor: "rgba(16, 185, 129, 0.35)",
                      }}
                    >
                      Leído
                    </span>
                  )}
                  {book.year && <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>({book.year})</span>}
                  {book.metadata_corrected && (
                    <span className="pill-tag" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#6ee7b7" }}>
                      IA Validado
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "0.85rem", color: "#a5b4fc", fontWeight: 600, marginBottom: "0.4rem" }}>{book.author}</div>
                {book.summary && (
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {book.summary}
                  </p>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                <button
                  onClick={(e) => handleToggleRead(e, book)}
                  disabled={updatingBookId === book.id}
                  className="btn btn-sm"
                  style={{
                    padding: "0.35rem 0.75rem",
                    fontSize: "0.78rem",
                    borderRadius: "6px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    background: book.is_read ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.05)",
                    borderColor: book.is_read ? "rgba(16, 185, 129, 0.45)" : "var(--border-subtle)",
                    color: book.is_read ? "#6ee7b7" : "var(--text-muted)",
                  }}
                  title={book.is_read ? "Haz clic para desmarcar como leído" : "Marcar como leído"}
                >
                  <BookCheck size={14} style={{ color: book.is_read ? "#34d399" : "var(--text-muted)" }} />
                  <span>{book.is_read ? "Leído" : "Marcar Leído"}</span>
                </button>

                <div className="tags-row">
                  {book.categories.slice(0, 2).map((cat) => (
                    <span key={cat} className="category-tag">{cat}</span>
                  ))}
                </div>
                <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", width: "80px", textAlign: "right" }}>
                  {book.chunk_count} chunks
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(book);
                    setDeleteModalOpen(true);
                  }}
                  className="btn btn-sm btn-danger"
                  style={{
                    padding: "0.35rem 0.65rem",
                    fontSize: "0.78rem",
                    borderRadius: "6px",
                  }}
                  title="Eliminar libro"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "1rem", borderTop: "1px solid var(--border-subtle)", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          <span>
            Mostrando página {page} de {totalPages} ({totalCount} libros en total)
          </span>

          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn btn-secondary btn-sm"
            >
              <ChevronLeft size={16} />
              <span>Anterior</span>
            </button>
            <span style={{ padding: "0.4rem 0.9rem", background: "rgba(255,255,255,0.06)", borderRadius: "var(--radius-sm)", fontWeight: 700, color: "#fff" }}>
              {page}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn btn-secondary btn-sm"
            >
              <span>Siguiente</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
      {/* Manual Book Modal */}
      <ManualBookModal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        onSaved={(newBook) => {
          loadBooks();
          if (onBookUpdated) onBookUpdated(newBook);
        }}
        availableCategories={categories}
      />

      {/* Delete Book Modal */}
      <DeleteBookModal
        isOpen={deleteModalOpen}
        book={deleteTarget}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeleteTarget(null);
        }}
        onDeleted={(bookId) => {
          setBooks((prev) => prev.filter((b) => b.id !== bookId));
          setTotalCount((c) => Math.max(0, c - 1));
          loadBooks();
          if (onBookUpdated && deleteTarget) onBookUpdated(deleteTarget);
        }}
        initialDeleteFile={false}
      />
    </div>
  );
}
