"use client";

import React, { useEffect, useState } from "react";
import {
  BookOpen,
  LayoutDashboard,
  Search,
  PlayCircle,
  Network,
  RefreshCw,
} from "lucide-react";

export type NavTab = "dashboard" | "books" | "search" | "cluster" | "process";

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  totalBooks?: number;
}

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  count?: number;
}

export function Navbar({ currentTab, onSelectTab, totalBooks }: NavbarProps) {
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
              >
                <Icon size={17} />
                <span>{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span className="nav-tab-badge">{item.count}</span>
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
