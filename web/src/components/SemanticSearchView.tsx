"use client";

import React, { useState } from "react";
import {
  Search,
  Sparkles,
  BookOpen,
  Copy,
  Check,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { BookDetail } from "@/lib/db";

interface SearchMatch {
  index: number;
  title: string;
  author: string;
  year: string;
  chapter: string;
  distance: number;
  similarity: number;
  content: string;
  bookId?: string | null;
  book?: BookDetail | null;
}

interface SemanticSearchViewProps {
  onSelectBook: (book: BookDetail) => void;
}

export function SemanticSearchView({ onSelectBook }: SemanticSearchViewProps) {
  const [query, setQuery] = useState("");
  const [author, setAuthor] = useState("");
  const [limit, setLimit] = useState(5);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [searched, setSearched] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [loadingBookKey, setLoadingBookKey] = useState<string | null>(null);

  const samplePrompts = [
    "Paradoja de Schrödinger y mecánica cuántica",
    "Viajes en el tiempo y la teoría de la relatividad",
    "¿Puede pensar una máquina y la inteligencia artificial?",
    "Sociedades distópicas y control totalitario",
    "La caída de imperios y crisis económicas históricas",
    "Meditación, consciencia y filosofía oriental",
  ];

  const handleSearch = async (searchQuery?: string) => {
    const q = (searchQuery || query).trim();
    if (!q) return;

    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({
        q,
        limit: String(limit),
      });
      if (author.trim()) params.set("author", author.trim());

      const res = await fetch(`/api/search?${params.toString()}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleOpenBookDetail = async (match: SearchMatch) => {
    if (match.book) {
      onSelectBook(match.book);
      return;
    }

    const key = match.bookId || match.title;
    setLoadingBookKey(key);

    try {
      if (match.bookId) {
        const res = await fetch(`/api/books?id=${encodeURIComponent(match.bookId)}`);
        if (res.ok) {
          const bookData = await res.json();
          onSelectBook(bookData);
          return;
        }
      }

      // Fallback: buscar por título exacto o parcial
      const res = await fetch(`/api/books?search=${encodeURIComponent(match.title)}&limit=1`);
      const data = await res.json();
      if (data.books && data.books.length > 0) {
        onSelectBook(data.books[0]);
      }
    } catch (e) {
      console.error("Error al obtener la ficha del libro:", e);
    } finally {
      setLoadingBookKey(null);
    }
  };

  return (
    <div className="search-container">
      {/* Top Search Hero */}
      <div className="search-hero">
        <div className="pill-tag" style={{ marginBottom: "0.8rem" }}>
          <Sparkles size={14} />
          <span>Búsqueda Vectorial Semántica (ChromaDB)</span>
        </div>
        <h1>Pregúntale a tu Biblioteca</h1>
        <p>
          Encuentra fragmentos, ideas y conceptos exactos a través de similitud de coseno, sin necesidad de coincidencia exacta de palabras.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="search-box-panel">
        <div className="search-row">
          <div className="search-input-wrapper">
            <Search className="search-input-icon" size={22} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Ej: ¿Qué libros hablan sobre el espacio-tiempo o agujeros negros?"
              className="search-main-input"
            />
          </div>

          <button
            onClick={() => handleSearch()}
            disabled={loading || !query.trim()}
            className="btn btn-primary"
            style={{ padding: "1.1rem 2.2rem", flexShrink: 0 }}
          >
            {loading ? (
              <>
                <div style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <span>Buscando...</span>
              </>
            ) : (
              <>
                <Search size={18} />
                <span>Buscar</span>
              </>
            )}
          </button>
        </div>

        {/* Filters bar */}
        <div className="search-filters-row">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <SlidersHorizontal size={15} style={{ color: "var(--text-muted)" }} />
            <span>Filtro por Autor (opcional):</span>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Ej: Stephen Hawking"
              className="form-input"
              style={{ width: "230px", padding: "0.55rem 0.95rem", fontSize: "0.85rem" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span>Resultados:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10))}
              className="form-select"
              style={{ width: "160px", padding: "0.55rem 0.95rem", fontSize: "0.85rem", cursor: "pointer" }}
            >
              <option value={3}>3 fragmentos</option>
              <option value={5}>5 fragmentos</option>
              <option value={10}>10 fragmentos</option>
              <option value={15}>15 fragmentos</option>
            </select>
          </div>
        </div>

        {/* Suggested Quick Prompts */}
        <div style={{ marginTop: "0.5rem" }}>
          <div className="suggested-prompts-title">
            Consultas sugeridas para probar:
          </div>
          <div className="prompt-chips-group">
            {samplePrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => {
                  setQuery(prompt);
                  handleSearch(prompt);
                }}
                className="prompt-chip"
              >
                <span>{prompt}</span>
                <ChevronRight size={14} style={{ color: "var(--accent-primary)" }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search Results Display */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--text-secondary)", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
          <div style={{ width: "36px", height: "36px", border: "3px solid rgba(99,102,241,0.2)", borderTopColor: "var(--accent-primary)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <p style={{ fontSize: "0.95rem" }}>Calculando similitud de coseno en ChromaDB...</p>
        </div>
      ) : searched && results.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: "4rem 2rem" }}>
          <div style={{ width: "54px", height: "54px", borderRadius: "14px", background: "rgba(99,102,241,0.12)", color: "var(--accent-primary)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
            <Search size={26} />
          </div>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>No se encontraron fragmentos</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", maxWidth: "420px", margin: "0 auto" }}>
            No se hallaron fragmentos con suficiente cercanía vectorial. Prueba con una pregunta más descriptiva o amplía los filtros.
          </p>
        </div>
      ) : results.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            <span>
              Se encontraron <strong style={{ color: "#fff" }}>{results.length}</strong> fragmentos más relevantes:
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
            {results.map((match) => {
              const itemKey = match.bookId || match.title;
              const isLoadingThis = loadingBookKey === itemKey;

              return (
                <div key={match.index} className="search-result-card">
                  {/* Result Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1.5rem", flexWrap: "wrap", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", flex: 1, minWidth: "260px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                        <span style={{ padding: "0.25rem 0.65rem", borderRadius: "8px", background: "rgba(99,102,241,0.2)", color: "#a5b4fc", fontWeight: 700, fontSize: "0.85rem" }}>
                          #{match.index}
                        </span>
                        
                        {/* Title - Clickable to open full book sheet */}
                        <h3
                          onClick={() => handleOpenBookDetail(match)}
                          style={{
                            fontSize: "1.15rem",
                            fontWeight: 700,
                            color: "#fff",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.45rem",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-primary)")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#fff")}
                          title="Haz clic para abrir la ficha completa de este libro"
                        >
                          <span>{match.title}</span>
                          <ExternalLink size={14} style={{ opacity: 0.7 }} />
                        </h3>

                        {match.year && <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>({match.year})</span>}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                        <span style={{ color: "#a5b4fc", fontWeight: 600 }}>{match.author}</span>
                        <span>•</span>
                        <span>{match.chapter}</span>
                      </div>

                      {/* Category tags from book if available */}
                      {match.book?.categories && match.book.categories.length > 0 && (
                        <div className="tags-row" style={{ marginTop: "0.2rem" }}>
                          {match.book.categories.map((c) => (
                            <span key={c} className="category-tag">
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons: Ver Ficha, Similarity Badge & Copy Button */}
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                      {/* Botón destacado para acceder a la ficha completa */}
                      <button
                        onClick={() => handleOpenBookDetail(match)}
                        disabled={isLoadingThis}
                        className="btn btn-sm btn-primary"
                        style={{ padding: "0.55rem 1.15rem", fontSize: "0.84rem" }}
                        title="Abrir la ficha completa del libro, sinopsis, fragmentos y opciones de descarga/apertura"
                      >
                        <BookOpen size={15} />
                        <span>{isLoadingThis ? "Cargando..." : "Ver Ficha del Libro"}</span>
                      </button>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#6ee7b7" }}>{match.similarity}% afinidad</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>distancia: {match.distance.toFixed(3)}</div>
                      </div>

                      <button
                        onClick={() => handleCopy(match.content, match.index)}
                        className="btn btn-secondary btn-sm"
                        title="Copiar fragmento"
                      >
                        {copiedIndex === match.index ? (
                          <>
                            <Check size={15} style={{ color: "var(--accent-emerald)" }} />
                            <span>Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy size={15} />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Excerpt Body */}
                  <div className="search-match-content">
                    {match.content}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
