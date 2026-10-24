"use client";

import React, { useState, useEffect } from "react";
import {
  Network,
  Sparkles,
  BookOpen,
  RefreshCw,
  Sliders,
  Layers,
  ArrowRight,
  Info,
} from "lucide-react";
import { BookDetail } from "@/lib/db";

interface ClusterSummary {
  cluster_id: number;
  cluster_label: string;
  count: number;
}

interface ClusteringViewProps {
  onSelectBook: (book: BookDetail) => void;
  onRefreshStats: () => void;
}

export function ClusteringView({ onSelectBook, onRefreshStats }: ClusteringViewProps) {
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [minClusterSize, setMinClusterSize] = useState(2);
  const [nClusters, setNClusters] = useState<number | "">("");
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);
  const [clusterBooks, setClusterBooks] = useState<BookDetail[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);

  const fetchClusters = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      setClusters(data.clusters || []);
    } catch {
      setClusters([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClusters();
  }, []);

  const loadClusterBooks = async (clusterId: number) => {
    setSelectedClusterId(clusterId);
    setLoadingBooks(true);
    try {
      const res = await fetch(`/api/books?cluster=${clusterId}&limit=100`);
      const data = await res.json();
      setClusterBooks(data.books || []);
    } catch {
      setClusterBooks([]);
    } finally {
      setLoadingBooks(false);
    }
  };

  const handleRunClustering = async () => {
    setRunning(true);
    try {
      const payload: any = {
        min_cluster_size: minClusterSize,
      };
      if (nClusters !== "" && Number(nClusters) > 1) {
        payload.n_clusters = Number(nClusters);
      }

      const res = await fetch("/api/cluster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.clusters) {
        setClusters(data.clusters);
        onRefreshStats();
        if (data.clusters[0]) {
          loadClusterBooks(data.clusters[0].cluster_id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
      {/* Top Header with ample margin & button spacing */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "2rem", flexWrap: "wrap" }}>
        <div style={{ maxWidth: "750px" }}>
          <div className="pill-tag" style={{ background: "rgba(6, 182, 212, 0.15)", borderColor: "rgba(6, 182, 212, 0.35)", color: "#67e8f9", marginBottom: "0.8rem" }}>
            <Network size={14} />
            <span>Descubrimiento No Supervisado (HDBSCAN)</span>
          </div>
          <h1 style={{ fontSize: "2.3rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.025em", marginBottom: "0.6rem" }}>
            Clustering Semántico de Libros
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1rem", lineHeight: 1.6 }}>
            Agrupa libros similares entre sí automáticamente basándose en los centroides vectoriales de sus fragmentos. Ideal para descubrir afinidades temáticas ocultas sin categorías predefinidas.
          </p>
        </div>

        {/* Action button with generous padding */}
        <button
          onClick={handleRunClustering}
          disabled={running}
          className="btn btn-primary"
          style={{ padding: "1.1rem 2.2rem", flexShrink: 0 }}
        >
          <RefreshCw size={18} style={{ animation: running ? "spin 1s linear infinite" : "none" }} />
          <span>{running ? "Calculando Clusters..." : "Reagrupar Archivo"}</span>
        </button>
      </div>

      {/* Control Options Panel */}
      <div className="panel" style={{ padding: "1.5rem 2.2rem", marginBottom: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1.5rem", fontSize: "0.9rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
              <Sliders size={18} style={{ color: "var(--accent-cyan)" }} />
              <span style={{ fontWeight: 600 }}>Mínimo por grupo (HDBSCAN):</span>
              <input
                type="number"
                min={2}
                max={20}
                value={minClusterSize}
                onChange={(e) => setMinClusterSize(parseInt(e.target.value, 10) || 2)}
                className="form-input"
                style={{ width: "80px", textAlign: "center", padding: "0.45rem 0.6rem", fontWeight: 700 }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
              <span style={{ fontWeight: 600 }}>Nº grupos fijo (opcional):</span>
              <input
                type="number"
                min={2}
                max={30}
                placeholder="Auto"
                value={nClusters}
                onChange={(e) => setNClusters(e.target.value ? parseInt(e.target.value, 10) : "")}
                className="form-input"
                style={{ width: "95px", textAlign: "center", padding: "0.45rem 0.6rem", fontWeight: 700 }}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            <Info size={16} style={{ color: "var(--accent-cyan)" }} />
            <span>Actualiza cluster_id y etiquetas automáticas en SQLite</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Column Clusters List, Right Column Member Books */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "2rem", alignItems: "start" }}>
        {/* Left: Clusters List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff" }}>
              Grupos Temáticos Identificados
            </h2>
            <span className="pill-tag" style={{ background: "rgba(6, 182, 212, 0.15)", color: "#67e8f9" }}>
              {clusters.length} grupos
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-secondary)" }}>
              Cargando clusters...
            </div>
          ) : clusters.length === 0 ? (
            <div className="panel" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
              <Network size={36} style={{ color: "var(--text-muted)", margin: "0 auto 1rem" }} />
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                Aún no se ha ejecutado el clustering. Haz clic en "Reagrupar Archivo" para generar los grupos.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "650px", overflowY: "auto", paddingRight: "0.5rem" }}>
              {clusters.map((c) => {
                const isSelected = selectedClusterId === c.cluster_id;
                return (
                  <div
                    key={c.cluster_id}
                    onClick={() => loadClusterBooks(c.cluster_id)}
                    className="card card-hover"
                    style={{
                      cursor: "pointer",
                      padding: "1.4rem 1.6rem",
                      borderColor: isSelected ? "var(--accent-primary)" : "var(--border-subtle)",
                      background: isSelected ? "rgba(99, 102, 241, 0.15)" : "var(--bg-surface)",
                      boxShadow: isSelected ? "0 0 20px rgba(99, 102, 241, 0.25)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "0.75rem" }}>
                      <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff", lineHeight: 1.35 }}>
                        {c.cluster_label || `Grupo #${c.cluster_id + 1}`}
                      </h3>
                      <span className="pill-tag" style={{ background: "rgba(6, 182, 212, 0.2)", color: "#67e8f9", flexShrink: 0 }}>
                        {c.count} libros
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      <span>Cluster #{c.cluster_id + 1}</span>
                      <span style={{ color: "var(--accent-primary)", display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 600 }}>
                        <span>Ver libros</span>
                        <ArrowRight size={14} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Selected Cluster Books */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff" }}>
              {selectedClusterId !== null
                ? `Libros en Grupo #${selectedClusterId + 1}`
                : "Libros del Grupo Seleccionado"}
            </h2>
            {clusterBooks.length > 0 && (
              <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>{clusterBooks.length} obras</span>
            )}
          </div>

          {loadingBooks ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "350px", gap: "1rem", color: "var(--text-secondary)" }}>
              <div style={{ width: "32px", height: "32px", border: "3px solid rgba(99,102,241,0.2)", borderTopColor: "var(--accent-primary)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              <p style={{ fontSize: "0.9rem" }}>Cargando libros del grupo...</p>
            </div>
          ) : clusterBooks.length === 0 ? (
            <div className="panel" style={{ textAlign: "center", padding: "4rem 2rem", color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              Selecciona un grupo temático de la izquierda para ver los libros que lo componen.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "650px", overflowY: "auto", paddingRight: "0.5rem" }}>
              {clusterBooks.map((book) => (
                <div
                  key={book.id}
                  onClick={() => onSelectBook(book)}
                  className="card card-hover"
                  style={{ cursor: "pointer", padding: "1.4rem 1.6rem" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "0.5rem" }}>
                    <div>
                      <h4 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff", marginBottom: "0.25rem" }}>
                        {book.title}
                      </h4>
                      <p style={{ fontSize: "0.86rem", color: "#a5b4fc", fontWeight: 600 }}>{book.author}</p>
                    </div>
                    {book.year && (
                      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "0.25rem 0.6rem", borderRadius: "6px", flexShrink: 0 }}>
                        {book.year}
                      </span>
                    )}
                  </div>

                  {book.summary && (
                    <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: "0.75rem", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {book.summary}
                    </p>
                  )}

                  <div className="tags-row">
                    {book.categories.map((c) => (
                      <span key={c} className="category-tag">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
