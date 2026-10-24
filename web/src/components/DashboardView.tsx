"use client";

import React from "react";
import {
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Layers,
  Tag,
  Network,
  PlayCircle,
  Search,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { BookDetail } from "@/lib/db";
import { NavTab } from "./Navbar";

interface DashboardStats {
  totalBooks: number;
  doneBooks: number;
  errorBooks: number;
  totalChunks: number;
  topCategories: Array<{ name: string; count: number }>;
  clusters: Array<{ cluster_id: number; cluster_label: string; count: number }>;
  recentBooks: BookDetail[];
}

interface DashboardViewProps {
  stats: DashboardStats | null;
  loading: boolean;
  onNavigate: (tab: NavTab) => void;
  onSelectBook: (book: BookDetail) => void;
}

export function DashboardView({
  stats,
  loading,
  onNavigate,
  onSelectBook,
}: DashboardViewProps) {
  if (loading || !stats) {
    return (
      <div style={{ textAlign: "center", padding: "5rem 0", color: "var(--text-secondary)" }}>
        <p>Cargando métricas del archivo...</p>
      </div>
    );
  }

  const maxCategoryCount = stats.topCategories[0]?.count || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
      {/* Hero Welcome Banner */}
      <div className="panel" style={{ position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "2rem" }}>
          <div style={{ maxWidth: "680px" }}>
            <div className="pill-tag" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", marginBottom: "1rem" }}>
              <Sparkles size={13} />
              <span>Pipeline Local Activo</span>
            </div>
            <h1 style={{ fontSize: "2.2rem", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.8rem", letterSpacing: "-0.02em" }}>
              Archivo Inteligente de EPUBs
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "1rem", lineHeight: 1.6 }}>
              Extracción profunda de capítulos XHTML, división semántica sin cortes abruptos, resúmenes automáticos y base de datos vectorial en ChromaDB impulsada por modelos locales.
            </p>
          </div>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <button onClick={() => onNavigate("process")} className="btn btn-primary">
              <PlayCircle size={18} />
              <span>Procesar Colección</span>
            </button>
            <button onClick={() => onNavigate("search")} className="btn btn-secondary">
              <Search size={18} />
              <span>Búsqueda IA</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Stat Metric Cards */}
      <div className="stats-grid">
        {/* Card 1: Total Books */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Libros en Archivo</span>
            <div className="stat-icon" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#818cf8" }}>
              <BookOpen size={20} />
            </div>
          </div>
          <div>
            <div className="stat-value">{stats.totalBooks}</div>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>títulos catalogados</span>
          </div>
          <div className="stat-footer" style={{ display: "flex", gap: "1rem" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "var(--accent-emerald)" }}>
              <CheckCircle2 size={13} />
              {stats.doneBooks} listos
            </span>
            {stats.errorBooks > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "var(--accent-rose)" }}>
                <AlertCircle size={13} />
                {stats.errorBooks} fallidos
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Chunks */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Fragmentos Vectorizados</span>
            <div className="stat-icon" style={{ background: "rgba(6, 182, 212, 0.15)", color: "#22d3ee" }}>
              <Layers size={20} />
            </div>
          </div>
          <div>
            <div className="stat-value">{stats.totalChunks.toLocaleString()}</div>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>en ChromaDB</span>
          </div>
          <div className="stat-footer">
            Embeddings semánticos calculados
          </div>
        </div>

        {/* Card 3: Categories */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Taxonomía & Categorías</span>
            <div className="stat-icon" style={{ background: "rgba(139, 92, 246, 0.15)", color: "#a78bfa" }}>
              <Tag size={20} />
            </div>
          </div>
          <div>
            <div className="stat-value">{stats.topCategories.length}</div>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>temáticas principales</span>
          </div>
          <div className="stat-footer">
            Clasificadas por LLM Zero-Shot
          </div>
        </div>

        {/* Card 4: Clusters */}
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Clusters Descubiertos</span>
            <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
              <Network size={20} />
            </div>
          </div>
          <div>
            <div className="stat-value">{stats.clusters.length}</div>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>grupos temáticos</span>
          </div>
          <div className="stat-footer">
            Agrupados por HDBSCAN
          </div>
        </div>
      </div>

      {/* Main Grid: Categories Chart & Discovered Clusters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "2rem" }}>
        {/* Categories Bar Chart Panel */}
        <div className="panel" style={{ flex: 1.5, marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <TrendingUp size={20} color="var(--accent-primary)" />
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff" }}>Distribución por Categorías</h2>
            </div>
            <button
              onClick={() => onNavigate("books")}
              className="btn btn-sm btn-secondary"
            >
              <span>Ver catálogo</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {stats.topCategories.slice(0, 8).map((cat) => {
              const percent = Math.round((cat.count / maxCategoryCount) * 100);
              return (
                <div key={cat.name} style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                    <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{cat.name}</span>
                    <span style={{ color: "var(--text-secondary)", fontWeight: 700 }}>{cat.count} libros</span>
                  </div>
                  <div style={{ width: "100%", height: "8px", borderRadius: "4px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${percent}%`,
                        height: "100%",
                        borderRadius: "4px",
                        background: "linear-gradient(90deg, #6366f1, #06b6d4)",
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Discovered Clusters List */}
        <div className="panel" style={{ flex: 1, marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Network size={20} color="var(--accent-cyan)" />
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff" }}>Clusters Temáticos</h2>
            </div>
            <button onClick={() => onNavigate("cluster")} className="btn btn-sm btn-secondary">
              <span>Gestionar</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "1.2rem" }}>
            Descubrimiento no supervisado por afinidad vectorial de contenido:
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "380px", overflowY: "auto", paddingRight: "0.3rem" }}>
            {stats.clusters.map((c) => (
              <div
                key={c.cluster_id}
                onClick={() => onNavigate("cluster")}
                className="card card-hover"
                style={{ padding: "1rem", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#fff" }}>
                    {c.cluster_label || `Grupo #${c.cluster_id + 1}`}
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Grupo ID #{c.cluster_id + 1}</span>
                </div>
                <span className="pill-tag" style={{ background: "rgba(6, 182, 212, 0.15)", borderColor: "rgba(6, 182, 212, 0.3)", color: "#67e8f9" }}>
                  {c.count} libros
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Books Grid */}
      {stats.recentBooks && stats.recentBooks.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#fff" }}>Libros Procesados Recientemente</h2>
            <button onClick={() => onNavigate("books")} className="btn btn-sm btn-secondary">
              <span>Explorar todo el catálogo ({stats.totalBooks})</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="books-grid">
            {stats.recentBooks.map((book) => (
              <div
                key={book.id}
                onClick={() => onSelectBook(book)}
                className="book-card"
              >
                <div className="book-card-body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", lineHeight: 1.35 }}>
                      {book.title}
                    </h3>
                    {book.year && (
                      <span className="pill-tag">{book.year}</span>
                    )}
                  </div>
                  <div className="book-author">{book.author}</div>
                  {book.summary && (
                    <p className="book-summary">{book.summary}</p>
                  )}
                </div>

                <div className="book-card-footer">
                  <div className="tags-row">
                    {book.categories.slice(0, 2).map((cat) => (
                      <span key={cat} className="category-tag">{cat}</span>
                    ))}
                  </div>
                  <span>{book.chunk_count} chunks</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
