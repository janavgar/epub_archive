"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Save,
  AlertTriangle,
  BookOpen,
  Tag,
  Plus,
  Check,
  FileText,
  Sparkles,
  Layers,
  Calendar,
  Building,
  Globe,
} from "lucide-react";
import { BookDetail } from "@/lib/db";

interface ManualBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBook?: BookDetail | null;
  onSaved: (book: BookDetail) => void;
  availableCategories?: string[];
}

const DEFAULT_CATEGORY_SUGGESTIONS = [
  "Ficción",
  "Ciencia Ficción",
  "Historia",
  "Filosofía",
  "Biografía",
  "Ensayo",
  "Divulgación Científica",
  "Misterio",
  "Fantasía",
  "Poesía",
  "Economía",
  "Psicología",
  "Tecnología",
  "Clásicos",
];

export function ManualBookModal({
  isOpen,
  onClose,
  initialBook,
  onSaved,
  availableCategories = [],
}: ManualBookModalProps) {
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [year, setYear] = useState("");
  const [language, setLanguage] = useState("es");
  const [publisher, setPublisher] = useState("");
  const [originalTitle, setOriginalTitle] = useState("");
  const [originalAuthor, setOriginalAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [summary, setSummary] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [contentSample, setContentSample] = useState("");
  const [chapterTitle, setChapterTitle] = useState("Capítulo 1");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Merge available categories from library with defaults
  const suggestions = Array.from(
    new Set([...availableCategories, ...DEFAULT_CATEGORY_SUGGESTIONS])
  ).filter((cat) => !categories.includes(cat));

  useEffect(() => {
    if (!isOpen) return;

    if (initialBook) {
      setId(initialBook.id || "");
      setTitle(initialBook.title || "");
      setAuthor(initialBook.author && initialBook.author !== "Desconocido" ? initialBook.author : "");
      setYear(initialBook.year || "");
      setLanguage(initialBook.language || "es");
      setPublisher(initialBook.publisher || "");
      setOriginalTitle(initialBook.original_title || "");
      setOriginalAuthor(initialBook.original_author || "");
      setDescription(initialBook.description || "");
      setSummary(initialBook.summary || "");
      setCategories(Array.isArray(initialBook.categories) ? initialBook.categories : []);
      setKeywords(Array.isArray(initialBook.keywords) ? initialBook.keywords : []);
      setContentSample("");
      setChapterTitle("Capítulo 1");
    } else {
      setId("");
      setTitle("");
      setAuthor("");
      setYear("");
      setLanguage("es");
      setPublisher("");
      setOriginalTitle("");
      setOriginalAuthor("");
      setDescription("");
      setSummary("");
      setCategories([]);
      setKeywords([]);
      setContentSample("");
      setChapterTitle("Capítulo 1");
    }
    setErrorMsg(null);
  }, [isOpen, initialBook]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !saving) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, saving, onClose]);

  if (!isOpen) return null;

  const isResolvingError = initialBook && initialBook.status === "error";

  const handleAddCategory = (cat: string) => {
    const trimmed = cat.trim();
    if (trimmed && !categories.includes(trimmed)) {
      setCategories([...categories, trimmed]);
    }
    setCategoryInput("");
  };

  const handleRemoveCategory = (cat: string) => {
    setCategories(categories.filter((c) => c !== cat));
  };

  const handleAddKeyword = (keyw: string) => {
    const trimmed = keyw.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
    }
    setKeywordInput("");
  };

  const handleRemoveKeyword = (keyw: string) => {
    setKeywords(keywords.filter((k) => k !== keyw));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!id.trim()) {
      setErrorMsg("Debes especificar la ruta del archivo o un identificador único.");
      return;
    }
    if (!title.trim()) {
      setErrorMsg("El título del libro es obligatorio.");
      return;
    }
    if (!author.trim()) {
      setErrorMsg("El autor del libro es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/books/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: id.trim(),
          title: title.trim(),
          author: author.trim(),
          year: year.trim(),
          language: language.trim() || "es",
          publisher: publisher.trim(),
          original_title: originalTitle.trim(),
          original_author: originalAuthor.trim(),
          description: description.trim(),
          summary: summary.trim(),
          categories,
          keywords,
          content_sample: contentSample.trim(),
          chapter_title: chapterTitle.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Error al guardar el libro");
      }

      onSaved(data.book);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al conectar con el servidor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="modal-dialog"
        style={{
          maxWidth: "840px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: "1.75rem 2.2rem 1.4rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: isResolvingError
                  ? "rgba(244, 63, 94, 0.16)"
                  : "rgba(99, 102, 241, 0.16)",
                color: isResolvingError ? "#fb7185" : "var(--accent-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isResolvingError ? <AlertTriangle size={22} /> : <BookOpen size={22} />}
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: "1.35rem" }}>
                {isResolvingError
                  ? "Subsanar Libro con Error Automático"
                  : "Introducir Libro Manualmente"}
              </h2>
              <p className="modal-subtitle" style={{ fontSize: "0.88rem", marginTop: "0.2rem" }}>
                {isResolvingError
                  ? "Define los metadatos correctos para recuperar este EPUB y añadirlo al catálogo activo."
                  : "Registra un nuevo libro en la base de datos bibliográfica sin depender del pipeline automático."}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={saving}
            className="modal-close-btn"
            title="Cerrar modal (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <form
          id="manual-book-form"
          onSubmit={handleSubmit}
          className="modal-body"
          style={{
            padding: "1.8rem 2.2rem",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
          {/* Error Banner if resolving failed book */}
          {isResolvingError && initialBook.error && (
            <div
              style={{
                padding: "1.1rem 1.3rem",
                borderRadius: "var(--radius-md)",
                background: "rgba(244, 63, 94, 0.08)",
                border: "1px solid rgba(244, 63, 94, 0.3)",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: "#fb7185",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                <AlertTriangle size={15} />
                <span>Error detectado en el proceso automático:</span>
              </div>
              <pre
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.82rem",
                  color: "#fecdd3",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  lineHeight: 1.45,
                  margin: 0,
                  background: "rgba(0, 0, 0, 0.3)",
                  padding: "0.6rem 0.8rem",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                {initialBook.error}
              </pre>
              <p style={{ fontSize: "0.8rem", color: "#fda4af", margin: 0 }}>
                💡 Al guardar este formulario, el estado cambiará a <strong>completado</strong> (done) y el libro se moverá al catálogo principal con los metadatos indicados.
              </p>
            </div>
          )}

          {errorMsg && (
            <div
              style={{
                padding: "0.9rem 1.2rem",
                borderRadius: "var(--radius-md)",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#fca5a5",
                fontSize: "0.88rem",
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
              }}
            >
              <AlertTriangle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Identification / File Path */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            <label
              style={{
                fontSize: "0.84rem",
                fontWeight: 700,
                color: "var(--text-main)",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <FileText size={14} style={{ color: "var(--accent-primary)" }} />
              <span>Ruta del Archivo EPUB / Identificador Único *</span>
            </label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="/Users/usuario/mis-libros/nombre-libro.epub"
              className="form-input"
              style={{ fontFamily: "monospace", fontSize: "0.86rem" }}
              required
            />
            <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
              Ruta absoluta en el disco para que coincida con el libro fallido o identificador único.
            </span>
          </div>

          {/* Primary Metadata: Title and Author */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1.2rem",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              <label
                style={{
                  fontSize: "0.84rem",
                  fontWeight: 700,
                  color: "var(--text-main)",
                }}
              >
                Título del Libro *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Cien Años de Soledad"
                className="form-input"
                required
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              <label
                style={{
                  fontSize: "0.84rem",
                  fontWeight: 700,
                  color: "var(--text-main)",
                }}
              >
                Autor *
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Ej. Gabriel García Márquez"
                className="form-input"
                required
              />
            </div>
          </div>

          {/* Secondary Details: Year, Language, Publisher */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "1.2rem",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              <label
                style={{
                  fontSize: "0.84rem",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                }}
              >
                <Calendar size={13} />
                <span>Año de Publicación</span>
              </label>
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="Ej. 1967"
                className="form-input"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              <label
                style={{
                  fontSize: "0.84rem",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                }}
              >
                <Globe size={13} />
                <span>Idioma</span>
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="form-select"
              >
                <option value="es">Español (es)</option>
                <option value="en">Inglés (en)</option>
                <option value="fr">Francés (fr)</option>
                <option value="de">Alemán (de)</option>
                <option value="it">Italiano (it)</option>
                <option value="pt">Portugués (pt)</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              <label
                style={{
                  fontSize: "0.84rem",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                }}
              >
                <Building size={13} />
                <span>Editorial</span>
              </label>
              <input
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="Ej. Editorial Sudamericana"
                className="form-input"
              />
            </div>
          </div>

          {/* Original metadata (if translated or modified) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1.2rem",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              <label
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                }}
              >
                Título Original (OPF / Idioma nativo)
              </label>
              <input
                type="text"
                value={originalTitle}
                onChange={(e) => setOriginalTitle(e.target.value)}
                placeholder="Dejar en blanco para usar el título principal"
                className="form-input"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              <label
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                }}
              >
                Autor Original
              </label>
              <input
                type="text"
                value={originalAuthor}
                onChange={(e) => setOriginalAuthor(e.target.value)}
                placeholder="Dejar en blanco para usar el autor principal"
                className="form-input"
              />
            </div>
          </div>

          {/* Categories Management */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <label
              style={{
                fontSize: "0.84rem",
                fontWeight: 700,
                color: "var(--text-main)",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Tag size={14} style={{ color: "var(--accent-primary)" }} />
              <span>Categorías Temáticas</span>
            </label>

            {/* Selected Tags */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", minHeight: "32px" }}>
              {categories.map((cat) => (
                <span
                  key={cat}
                  className="pill-tag pill-tag-primary"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: "0.35rem 0.75rem",
                    fontSize: "0.84rem",
                  }}
                >
                  <span>{cat}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCategory(cat)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "inherit",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                    }}
                    title="Eliminar categoría"
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}

              {categories.length === 0 && (
                <span style={{ fontSize: "0.84rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                  Sin categorías asignadas
                </span>
              )}
            </div>

            {/* Input to add tag */}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="text"
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    handleAddCategory(categoryInput);
                  }
                }}
                placeholder="Escribe una categoría y pulsa Enter o pulsa '+ Añadir'..."
                className="form-input"
                style={{ fontSize: "0.88rem" }}
              />
              <button
                type="button"
                onClick={() => handleAddCategory(categoryInput)}
                className="btn btn-secondary"
                disabled={!categoryInput.trim()}
              >
                <Plus size={15} />
                <span>Añadir</span>
              </button>
            </div>

            {/* Quick Suggestions */}
            {suggestions.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
                <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>Sugerencias:</span>
                {suggestions.slice(0, 8).map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => handleAddCategory(sug)}
                    className="pill-tag"
                    style={{
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    + {sug}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Keywords Management */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <label
              style={{
                fontSize: "0.84rem",
                fontWeight: 700,
                color: "var(--text-main)",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Sparkles size={14} style={{ color: "#a5b4fc" }} />
              <span>Palabras Clave (Keywords)</span>
            </label>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", minHeight: "32px" }}>
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className="pill-tag"
                  style={{
                    background: "rgba(165, 180, 252, 0.12)",
                    color: "#c7d2fe",
                    borderColor: "rgba(165, 180, 252, 0.25)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    padding: "0.35rem 0.75rem",
                    fontSize: "0.82rem",
                  }}
                >
                  <span>{kw}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(kw)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "inherit",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                    }}
                    title="Eliminar palabra clave"
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
              {keywords.length === 0 && (
                <span style={{ fontSize: "0.84rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                  Sin palabras clave
                </span>
              )}
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    handleAddKeyword(keywordInput);
                  }
                }}
                placeholder="Añade palabras clave conceptuales (separadas por coma o Enter)..."
                className="form-input"
                style={{ fontSize: "0.88rem" }}
              />
              <button
                type="button"
                onClick={() => handleAddKeyword(keywordInput)}
                className="btn btn-secondary"
                disabled={!keywordInput.trim()}
              >
                <Plus size={15} />
                <span>Añadir</span>
              </button>
            </div>
          </div>

          {/* Description & Executive Summary */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            <label
              style={{
                fontSize: "0.84rem",
                fontWeight: 700,
                color: "var(--text-main)",
              }}
            >
              Sinopsis / Descripción Comercial
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Sinopsis oficial o contraportada del libro..."
              rows={3}
              className="form-input"
              style={{ resize: "vertical", minHeight: "80px", lineHeight: 1.5 }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            <label
              style={{
                fontSize: "0.84rem",
                fontWeight: 700,
                color: "var(--text-main)",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Sparkles size={14} style={{ color: "var(--accent-primary)" }} />
              <span>Resumen Ejecutivo / Análisis Conceptual</span>
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Resumen temático o argumento detallado del libro..."
              rows={4}
              className="form-input"
              style={{ resize: "vertical", minHeight: "95px", lineHeight: 1.5 }}
            />
          </div>

          {/* Optional Content Sample / Manual Reading Fragment */}
          <div
            style={{
              padding: "1.2rem 1.4rem",
              borderRadius: "var(--radius-md)",
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "0.8rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Layers size={16} style={{ color: "var(--accent-cyan)" }} />
              <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fff" }}>
                Texto de Muestra / Fragmento de Lectura (Opcional)
              </span>
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: 0 }}>
              Si el archivo EPUB estaba dañado internamente (Bad Zip) pero dispones de una cita o texto representativo, puedes pegarlo aquí para que aparezca en el visor de lectura.
            </p>

            <div style={{ display: "flex", gap: "0.8rem" }}>
              <input
                type="text"
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                placeholder="Título del capítulo (ej. Introducción)"
                className="form-input"
                style={{ maxWidth: "250px", fontSize: "0.84rem" }}
              />
            </div>

            <textarea
              value={contentSample}
              onChange={(e) => setContentSample(e.target.value)}
              placeholder="Pega aquí párrafos o fragmentos clave de la obra..."
              rows={4}
              className="form-input"
              style={{ resize: "vertical", minHeight: "90px", fontSize: "0.88rem", lineHeight: 1.5 }}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: "1.2rem 2.2rem" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn btn-secondary"
          >
            Cancelar
          </button>

          <button
            type="submit"
            form="manual-book-form"
            disabled={saving}
            className="btn btn-primary"
            style={{ minWidth: "190px", justifyContent: "center" }}
          >
            {saving ? (
              <>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{isResolvingError ? "Guardar y Resolver Error" : "Guardar en Catálogo"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
