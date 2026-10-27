"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  BookOpen,
  LayoutDashboard,
  Search,
  PlayCircle,
  Network,
  RefreshCw,
  AlertTriangle,
  Menu,
  X,
  ChevronRight,
  Cpu,
  Copy,
  Terminal,
} from "lucide-react";
import { useProcess } from "./ProcessContext";

export type NavTab = "dashboard" | "books" | "duplicates" | "errors" | "search" | "cluster" | "process";

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  totalBooks?: number;
  errorBooks?: number;
  duplicateGroups?: number;
}

interface NavItem {
  id: NavTab;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; size?: number; style?: React.CSSProperties }>;
  count?: number;
  isAlert?: boolean;
}

export function Navbar({ currentTab, onSelectTab, totalBooks, errorBooks, duplicateGroups }: NavbarProps) {
  const { isRunning, isStopping, progress, toggleLogDrawer } = useProcess();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [modelStatus, setModelStatus] = useState<{
    online: boolean;
    chatModel?: string | null;
    embeddingModel?: string | null;
    loading: boolean;
  }>({ online: false, loading: true });

  const tabsScrollRef = useRef<HTMLDivElement>(null);

  const checkStatus = async () => {
    try {
      setModelStatus((prev) => ({ ...prev, loading: true }));
      const res = await fetch("/api/models");
      const data = await res.json();
      setModelStatus({
        online: data.online,
        chatModel: data.recommendedChatModel,
        embeddingModel: data.recommendedEmbeddingModel,
        loading: false,
      });
    } catch {
      setModelStatus({ online: false, loading: false });
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Cerrar menú móvil al redimensionar a pantalla grande
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Centrar la pestaña activa en el contenedor con scroll en pantallas estrechas sin desplazar la ventana
  useEffect(() => {
    const container = tabsScrollRef.current;
    if (!container) return;

    if (container.scrollWidth > container.clientWidth) {
      const activeBtn = container.querySelector(".nav-tab-btn.active") as HTMLElement | null;
      if (activeBtn) {
        const targetScrollLeft =
          activeBtn.offsetLeft - (container.clientWidth - activeBtn.clientWidth) / 2;
        container.scrollTo({
          left: Math.max(0, targetScrollLeft),
          behavior: "smooth",
        });
      }
    }

    // Asegurar que la ventana nunca quede desplazada horizontalmente
    if (typeof window !== "undefined" && window.scrollX !== 0) {
      window.scrollTo({ left: 0 });
    }
  }, [currentTab]);

  const navItems: NavItem[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      description: "Métricas del archivo y actividad reciente",
      icon: LayoutDashboard,
    },
    {
      id: "books",
      label: "Biblioteca",
      description: "Catálogo completo con filtros y estado de lectura",
      icon: BookOpen,
      count: totalBooks,
    },
    {
      id: "duplicates",
      label: "Duplicados",
      description: "Detección y eliminación de libros redundantes",
      icon: Copy,
      count: duplicateGroups,
    },
    {
      id: "errors",
      label: "Errores",
      description: "EPUBs no clasificados para diagnóstico y descarga",
      icon: AlertTriangle,
      count: errorBooks,
      isAlert: true,
    },
    {
      id: "search",
      label: "Búsqueda IA",
      description: "Búsqueda conceptual y semántica en ChromaDB",
      icon: Search,
    },
    {
      id: "cluster",
      label: "Clustering",
      description: "Descubrimiento de grupos temáticos automáticos",
      icon: Network,
    },
    {
      id: "process",
      label: "Procesador",
      description: "Extracción profunda de EPUBs y vectorización",
      icon: PlayCircle,
    },
  ];

  const handleSelect = (tab: NavTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="app-navbar">
      <div className="navbar-inner">
        {/* Top row with Brand, compact Status and Mobile Toggle */}
        <div className="navbar-top-row">
          {/* Brand Logo */}
          <div className="brand-badge" onClick={() => handleSelect("dashboard")}>
            <div className="brand-icon">
              <BookOpen size={20} />
            </div>
            <div className="brand-text-group">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className="brand-title">EPUB Archive</span>
                <span className="pill-tag brand-pill">AI Pipeline</span>
              </div>
              <p className="brand-subtitle">Gestión & Clasificación con IA Local</p>
            </div>
          </div>

          {/* Right actions: Process indicator + Server status + Mobile toggle button */}
          <div className="navbar-actions">
            {/* Visual Process Status Indicator Pill */}
            {(isRunning || isStopping) && (
              <button
                type="button"
                onClick={toggleLogDrawer}
                className={`navbar-process-pill ${isStopping ? "stopping" : "running"}`}
                title="Haga clic para ver el log en tiempo real o detener el proceso"
              >
                <span className={`status-dot ${isStopping ? "stopping" : "online"}`} />
                <span className="navbar-process-text">
                  {isStopping
                    ? "Deteniendo..."
                    : progress
                    ? `Indexando (${progress.percent.toFixed(0)}%)`
                    : "Indexando..."}
                </span>
                <span className="navbar-process-text-mobile">
                  {isStopping ? "Detener" : progress ? `${progress.percent.toFixed(0)}%` : "Indexando"}
                </span>
                <span className="navbar-process-btn-badge">Ver Log</span>
              </button>
            )}

            {/* LM Studio Endpoint Status */}
            <div
              className="server-status-pill"
              title={modelStatus.online ? `LM Studio Online: ${modelStatus.chatModel || 'Activo'}` : 'LM Studio Desconectado'}
            >
              <span className={`status-dot ${modelStatus.online ? "online" : "offline"}`} />
              <span className="status-text">{modelStatus.online ? "LM Studio Online" : "LM Studio Offline"}</span>
              <span className="status-text-mobile">{modelStatus.online ? "Online" : "Offline"}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  checkStatus();
                }}
                className="status-refresh-btn"
                title="Actualizar estado de conexión"
              >
                <RefreshCw size={13} style={{ animation: modelStatus.loading ? "spin 1s linear infinite" : "none" }} />
              </button>
            </div>

            {/* Mobile Hamburger / Close Button */}
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="mobile-menu-toggle"
              aria-label={mobileMenuOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
              title={mobileMenuOpen ? "Cerrar menú" : "Menú de navegación"}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Desktop and Touch-friendly Horizontal Tabs Bar */}
        <div className="nav-tabs-wrapper" ref={tabsScrollRef}>
          <nav className="nav-tabs">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = currentTab === item.id;
              const isProcessTab = item.id === "process";
              const isProcessActive = isProcessTab && (isRunning || isStopping);

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`nav-tab-btn ${active ? "active" : ""} ${isProcessActive ? "process-running" : ""}`}
                  style={item.isAlert && item.count && item.count > 0 ? { borderColor: active ? undefined : "rgba(244, 63, 94, 0.25)" } : undefined}
                >
                  <Icon size={16} style={item.isAlert && item.count && item.count > 0 ? { color: "#fb7185" } : undefined} />
                  <span>{item.label}</span>
                  {isProcessActive ? (
                    <span className="nav-tab-badge process-badge">
                      <span className="process-mini-spinner" />
                      {progress ? `${progress.percent.toFixed(0)}%` : "Activo"}
                    </span>
                  ) : item.count !== undefined && item.count > 0 ? (
                    <span
                      className="nav-tab-badge"
                      style={item.isAlert ? { background: "rgba(244, 63, 94, 0.2)", color: "#fda4af", border: "1px solid rgba(244, 63, 94, 0.35)" } : undefined}
                    >
                      {item.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Drawer (Visible when hamburger is toggled) */}
      {mobileMenuOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                Navegación del Archivo
              </span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="btn btn-secondary btn-sm"
                style={{ padding: "0.3rem 0.65rem", fontSize: "0.78rem" }}
              >
                <X size={15} />
                <span>Cerrar</span>
              </button>
            </div>

            <div className="mobile-drawer-items">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`mobile-drawer-btn ${active ? "active" : ""}`}
                  >
                    <div className="mobile-drawer-btn-left">
                      <div
                        className="mobile-drawer-icon"
                        style={{
                          background: active ? "var(--accent-primary)" : "rgba(255,255,255,0.06)",
                          color: active ? "#fff" : item.isAlert && item.count && item.count > 0 ? "#fb7185" : "var(--text-secondary)",
                        }}
                      >
                        <Icon size={18} />
                      </div>
                      <div className="mobile-drawer-btn-text">
                        <div className="mobile-drawer-btn-title">
                          <span>{item.label}</span>
                          {item.id === "process" && (isRunning || isStopping) ? (
                            <span className="nav-tab-badge process-badge">
                              <span className="process-mini-spinner" />
                              {progress ? `${progress.percent.toFixed(0)}%` : "Activo"}
                            </span>
                          ) : item.count !== undefined && item.count > 0 ? (
                            <span
                              className="nav-tab-badge"
                              style={item.isAlert ? { background: "rgba(244, 63, 94, 0.2)", color: "#fda4af", border: "1px solid rgba(244, 63, 94, 0.35)" } : undefined}
                            >
                              {item.count}
                            </span>
                          ) : null}
                        </div>
                        <p className="mobile-drawer-btn-desc">{item.description}</p>
                      </div>
                    </div>
                    <ChevronRight size={16} style={{ color: active ? "var(--accent-primary)" : "var(--text-muted)" }} />
                  </button>
                );
              })}
            </div>

            {/* Mobile Server Info Card */}
            <div className="mobile-drawer-footer">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                <Cpu size={14} color="var(--accent-cyan)" />
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff" }}>Estado del Pipeline Local</span>
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                {modelStatus.online
                  ? `LM Studio conectado. Modelo chat: ${modelStatus.chatModel || 'Estándar'}`
                  : 'LM Studio no detectado en localhost:1234. Inicia LM Studio para clasificación y embeddings.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
