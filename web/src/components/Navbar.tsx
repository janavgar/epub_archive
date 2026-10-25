"use client";

import React, { useEffect, useState } from "react";
import {
  BookOpen,
  LayoutDashboard,
  Search,
  PlayCircle,
  Network,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

export type NavTab = "dashboard" | "books" | "errors" | "search" | "cluster" | "process";

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  totalBooks?: number;
  errorBooks?: number;
}

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number; style?: React.CSSProperties }>;
  count?: number;
  isAlert?: boolean;
}

export function Navbar({ currentTab, onSelectTab, totalBooks, errorBooks }: NavbarProps) {
  const [modelStatus, setModelStatus] = useState<{
    online: boolean;
    chatModel?: string | null;
    embeddingModel?: string | null;
    loading: boolean;
  }>({ online: false, loading: true });

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

  const navItems: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "books", label: "Biblioteca", icon: BookOpen, count: totalBooks },
    { id: "errors", label: "Errores", icon: AlertTriangle, count: errorBooks, isAlert: true },
    { id: "search", label: "Búsqueda IA", icon: Search },
    { id: "cluster", label: "Clustering", icon: Network },
    { id: "process", label: "Procesador", icon: PlayCircle },
  ];

  return (
    <header className="app-navbar">
      <div className="navbar-inner">
        {/* Brand Logo */}
        <div className="brand-badge" onClick={() => onSelectTab("dashboard")}>
          <div className="brand-icon">
            <BookOpen size={22} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="brand-title">EPUB Archive</span>
              <span className="pill-tag">AI Pipeline</span>
            </div>
            <p className="brand-subtitle">Gestión & Clasificación con IA Local</p>
          </div>
        </div>

        {/* Navigation Tabs with generous spacing */}
        <nav className="nav-tabs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`nav-tab-btn ${active ? "active" : ""}`}
                style={item.isAlert && item.count && item.count > 0 ? { borderColor: active ? undefined : "rgba(244, 63, 94, 0.25)" } : undefined}
              >
                <Icon size={17} style={item.isAlert && item.count && item.count > 0 ? { color: "#fb7185" } : undefined} />
                <span>{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className="nav-tab-badge"
                    style={item.isAlert ? { background: "rgba(244, 63, 94, 0.2)", color: "#fda4af", border: "1px solid rgba(244, 63, 94, 0.35)" } : undefined}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* LM Studio Endpoint Status */}
        <div className="server-status-pill">
          <span className={`status-dot ${modelStatus.online ? "online" : "offline"}`} />
          <span>{modelStatus.online ? "LM Studio Online" : "LM Studio Offline"}</span>
          <button
            onClick={checkStatus}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              marginLeft: "0.25rem",
            }}
            title="Actualizar estado de conexión"
          >
            <RefreshCw size={13} style={{ animation: modelStatus.loading ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>
      </div>
    </header>
  );
}
