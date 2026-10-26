"use client";

import React, { useState } from "react";
import {
  Trash2,
  AlertTriangle,
  HardDrive,
  Database,
  X,
  Copy,
  Check,
  Loader2,
} from "lucide-react";

interface DeleteBookModalProps {
  isOpen: boolean;
  book: {
    id: string;
    title: string;
    author: string;
    year?: string;
  } | null;
  onClose: () => void;
  onDeleted: (bookId: string, fileDeleted: boolean) => void;
  initialDeleteFile?: boolean;
}

export function DeleteBookModal({
  isOpen,
  book,
  onClose,
  onDeleted,
  initialDeleteFile = false,
}: DeleteBookModalProps) {
  const [deleteStorage, setDeleteStorage] = useState(initialDeleteFile);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Synchronize initialDeleteFile when modal opens
  React.useEffect(() => {
    setDeleteStorage(initialDeleteFile);
    setError(null);
  }, [isOpen, initialDeleteFile]);

  if (!isOpen || !book) return null;

  const handleCopyPath = () => {
    navigator.clipboard.writeText(book.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/books/${encodeURIComponent(book.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteFile: deleteStorage }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo eliminar el libro");
      }

      onDeleted(book.id, data.fileDeleted ?? deleteStorage);
      onClose();
    } catch (err: any) {
      setError(err.message || "Error al procesar la eliminación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "600px",
          borderColor: "rgba(244, 63, 94, 0.35)",
          boxShadow: "0 25px 50px -12px rgba(244, 63, 94, 0.15)",
        }}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "var(--radius-md)",
                background: "rgba(244, 63, 94, 0.15)",
                border: "1px solid rgba(244, 63, 94, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#f43f5e",
              }}
            >
              <Trash2 size={20} />
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: "1.25rem", margin: 0 }}>
                Eliminar Libro EPUB
              </h2>
              <p className="modal-subtitle" style={{ margin: 0, fontSize: "0.82rem" }}>
                Gestión de archivo y eliminación de duplicados
              </p>
            </div>
          </div>

          <button onClick={onClose} className="modal-close-btn" title="Cerrar">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {error && (
            <div
              style={{
                padding: "0.85rem 1.1rem",
                borderRadius: "var(--radius-md)",
                background: "rgba(244, 63, 94, 0.15)",
                border: "1px solid rgba(244, 63, 94, 0.35)",
                color: "#fda4af",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Book Details Box */}
          <div
            style={{
              padding: "1rem 1.25rem",
              borderRadius: "var(--radius-md)",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#fff", marginBottom: "0.2rem" }}>
              {book.title}
            </div>
            <div style={{ color: "#a5b4fc", fontSize: "0.88rem", marginBottom: "0.6rem" }}>
              {book.author} {book.year ? `(${book.year})` : ""}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
                padding: "0.5rem 0.75rem",
                background: "rgba(0, 0, 0, 0.3)",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.75rem",
                fontFamily: "monospace",
                color: "var(--text-secondary)",
                wordBreak: "break-all",
              }}
            >
              <span>{book.id}</span>
              <button
                type="button"
                onClick={handleCopyPath}
                className="btn btn-secondary btn-sm"
                style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem", flexShrink: 0 }}
                title="Copiar ruta"
              >
                {copied ? <Check size={12} style={{ color: "#34d399" }} /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          {/* Option Selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Alcance de la eliminación
            </div>

            {/* Option 1: DB Only */}
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.9rem",
                padding: "1rem 1.15rem",
                borderRadius: "var(--radius-md)",
                border: !deleteStorage
                  ? "1px solid rgba(99, 102, 241, 0.6)"
                  : "1px solid var(--border-subtle)",
                background: !deleteStorage
                  ? "rgba(99, 102, 241, 0.1)"
                  : "rgba(255, 255, 255, 0.02)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <input
                type="radio"
                name="deleteScope"
                checked={!deleteStorage}
                onChange={() => setDeleteStorage(false)}
                style={{ marginTop: "0.25rem", accentColor: "var(--primary)" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontWeight: 700, color: "#fff", fontSize: "0.92rem", marginBottom: "0.2rem" }}>
                  <Database size={15} style={{ color: "#818cf8" }} />
                  <span>Eliminar solo de la Base de Datos</span>
                </div>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                  Borra el registro, fragmentos vectoriales y metadatos de SQLite y ChromaDB.{" "}
                  <strong style={{ color: "#34d399" }}>El archivo .epub se conservará intacto en el disco.</strong>
                </p>
              </div>
            </label>

            {/* Option 2: DB + Storage */}
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.9rem",
                padding: "1rem 1.15rem",
                borderRadius: "var(--radius-md)",
                border: deleteStorage
                  ? "1px solid rgba(244, 63, 94, 0.6)"
                  : "1px solid var(--border-subtle)",
                background: deleteStorage
                  ? "rgba(244, 63, 94, 0.12)"
                  : "rgba(255, 255, 255, 0.02)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <input
                type="radio"
                name="deleteScope"
                checked={deleteStorage}
                onChange={() => setDeleteStorage(true)}
                style={{ marginTop: "0.25rem", accentColor: "#f43f5e" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontWeight: 700, color: "#fda4af", fontSize: "0.92rem", marginBottom: "0.2rem" }}>
                  <HardDrive size={15} style={{ color: "#f43f5e" }} />
                  <span>Eliminar de la Base de Datos Y del Almacenamiento (Disco)</span>
                </div>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                  Ideal para <strong>eliminar libros duplicados</strong>. Borra el registro de la BD y{" "}
                  <strong style={{ color: "#fda4af" }}>elimina físicamente el archivo .epub de tu disco local</strong>.
                </p>
              </div>
            </label>
          </div>

          {deleteStorage && (
            <div
              style={{
                padding: "0.85rem 1.1rem",
                borderRadius: "var(--radius-md)",
                background: "rgba(244, 63, 94, 0.1)",
                border: "1px solid rgba(244, 63, 94, 0.3)",
                color: "#fda4af",
                fontSize: "0.8rem",
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
              }}
            >
              <AlertTriangle size={18} style={{ color: "#f43f5e", flexShrink: 0 }} />
              <span>
                <strong>Atención:</strong> Esta acción es irreversible. El archivo local se borrará permanentemente de tu equipo.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn btn-secondary btn-sm"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="btn btn-danger btn-sm"
            style={{
              padding: "0.6rem 1.3rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              fontWeight: 700,
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Eliminando...</span>
              </>
            ) : (
              <>
                <Trash2 size={16} />
                <span>
                  {deleteStorage ? "Eliminar de BD y Disco" : "Eliminar de la Base de Datos"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
