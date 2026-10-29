"use client";

import React, { useState, useEffect } from "react";
import {
  Cpu,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  Server,
  Key,
  Layers,
  Sparkles,
  RotateCcw,
  Globe,
  HardDrive,
} from "lucide-react";

interface ProviderPreset {
  id: string;
  name: string;
  defaultBaseUrl: string;
  requiresApiKey: boolean;
  local: boolean;
  description: string;
  placeholderChatModel: string;
  placeholderEmbeddingModel: string;
}

interface AIConfig {
  provider: string;
  base_url: string;
  api_key: string;
  chat_model: string;
  embedding_model: string;
  separate_embedding: boolean;
  embedding_provider: string;
  embedding_base_url: string;
  embedding_api_key: string;
  timeout: number;
}

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (statusData: any) => void;
}

export function AISettingsModal({ isOpen, onClose, onSaved }: AISettingsModalProps) {
  const [presets, setPresets] = useState<ProviderPreset[]>([]);
  const [provider, setProvider] = useState("lm_studio");
  const [baseUrl, setBaseUrl] = useState("http://localhost:1234/v1");
  const [apiKey, setApiKey] = useState("");
  const [chatModel, setChatModel] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [separateEmbedding, setSeparateEmbedding] = useState(false);
  const [embeddingProvider, setEmbeddingProvider] = useState("lm_studio");
  const [embeddingBaseUrl, setEmbeddingBaseUrl] = useState("http://localhost:1234/v1");
  const [embeddingApiKey, setEmbeddingApiKey] = useState("");

  const [detectedChatModels, setDetectedChatModels] = useState<string[]>([]);
  const [detectedEmbeddingModels, setDetectedEmbeddingModels] = useState<string[]>([]);
  const [autoChatModel, setAutoChatModel] = useState<string | null>(null);
  const [autoEmbeddingModel, setAutoEmbeddingModel] = useState<string | null>(null);

  const [chatOnline, setChatOnline] = useState<boolean | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [embOnline, setEmbOnline] = useState<boolean | null>(null);
  const [embError, setEmbError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [probingChat, setProbingChat] = useState(false);
  const [probingEmb, setProbingEmb] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadInitialConfig();
      setSaveMessage(null);
    }
  }, [isOpen]);

  const loadInitialConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/models");
      const data = await res.json();
      if (Array.isArray(data.presets)) {
        setPresets(data.presets);
      }
      if (data.config) {
        const cfg: AIConfig = data.config;
        setProvider(cfg.provider || "lm_studio");
        setBaseUrl(cfg.base_url || "http://localhost:1234/v1");
        setApiKey(cfg.api_key || "");
        setChatModel(cfg.chat_model || "");
        setEmbeddingModel(cfg.embedding_model || "");
        setSeparateEmbedding(Boolean(cfg.separate_embedding));
        setEmbeddingProvider(cfg.embedding_provider || cfg.provider || "lm_studio");
        setEmbeddingBaseUrl(
          cfg.embedding_base_url || cfg.base_url || "http://localhost:1234/v1"
        );
        setEmbeddingApiKey(cfg.embedding_api_key || "");
      }
      setDetectedChatModels(Array.isArray(data.models) ? data.models : []);
      setDetectedEmbeddingModels(
        Array.isArray(data.embeddingModels) ? data.embeddingModels : []
      );
      setAutoChatModel(data.autoDetectedChatModel || null);
      setAutoEmbeddingModel(data.autoDetectedEmbeddingModel || null);
      setChatOnline(Boolean(data.online));
      setChatError(data.error || null);
      setEmbOnline(Boolean(data.embeddingOnline));
      setEmbError(data.embeddingError || null);
    } catch (err: any) {
      setChatError(err.message || "Error al cargar la configuración");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProvider = (presetId: string) => {
    setProvider(presetId);
    const found = presets.find((p) => p.id === presetId);
    if (found) {
      setBaseUrl(found.defaultBaseUrl);
      probeChatEndpoint(presetId, found.defaultBaseUrl, apiKey);
    }
  };

  const handleSelectEmbeddingProvider = (presetId: string) => {
    setEmbeddingProvider(presetId);
    const found = presets.find((p) => p.id === presetId);
    if (found) {
      setEmbeddingBaseUrl(found.defaultBaseUrl);
      probeEmbeddingEndpoint(presetId, found.defaultBaseUrl, embeddingApiKey || apiKey);
    }
  };

  const probeChatEndpoint = async (
    targetProvider = provider,
    targetUrl = baseUrl,
    targetKey = apiKey
  ) => {
    try {
      setProbingChat(true);
      setChatError(null);
      const params = new URLSearchParams({
        probe: "1",
        provider: targetProvider,
        baseUrl: targetUrl,
        apiKey: targetKey,
      });
      const res = await fetch(`/api/models?${params.toString()}`);
      const data = await res.json();
      setChatOnline(Boolean(data.online));
      setChatError(data.error || null);
      if (data.baseUrl) {
        setBaseUrl(data.baseUrl);
      }
      const modelsList = Array.isArray(data.models) ? data.models : [];
      setDetectedChatModels(modelsList);
      setAutoChatModel(data.recommendedChatModel || null);

      if (!separateEmbedding) {
        const embList =
          Array.isArray(data.embeddingModels) && data.embeddingModels.length > 0
            ? data.embeddingModels
            : modelsList;
        setDetectedEmbeddingModels(embList);
        setAutoEmbeddingModel(data.recommendedEmbeddingModel || null);
        setEmbOnline(Boolean(data.online));
        setEmbError(data.error || null);
      }
    } catch (err: any) {
      setChatOnline(false);
      setChatError(err.message || "No se pudo conectar al servidor");
    } finally {
      setProbingChat(false);
    }
  };

  const probeEmbeddingEndpoint = async (
    targetProvider = embeddingProvider,
    targetUrl = embeddingBaseUrl,
    targetKey = embeddingApiKey || apiKey
  ) => {
    try {
      setProbingEmb(true);
      setEmbError(null);
      const params = new URLSearchParams({
        probe: "1",
        provider: targetProvider,
        baseUrl: targetUrl,
        apiKey: targetKey,
      });
      const res = await fetch(`/api/models?${params.toString()}`);
      const data = await res.json();
      setEmbOnline(Boolean(data.online));
      setEmbError(data.error || null);
      if (data.baseUrl) {
        setEmbeddingBaseUrl(data.baseUrl);
      }
      const modelsList = Array.isArray(data.models) ? data.models : [];
      const embList =
        Array.isArray(data.embeddingModels) && data.embeddingModels.length > 0
          ? data.embeddingModels
          : modelsList;
      setDetectedEmbeddingModels(embList);
      setAutoEmbeddingModel(data.recommendedEmbeddingModel || null);
    } catch (err: any) {
      setEmbOnline(false);
      setEmbError(err.message || "No se pudo conectar al servidor de embeddings");
    } finally {
      setProbingEmb(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveMessage(null);
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          base_url: baseUrl,
          api_key: apiKey,
          chat_model: chatModel,
          embedding_model: embeddingModel,
          separate_embedding: separateEmbedding,
          embedding_provider: separateEmbedding ? embeddingProvider : provider,
          embedding_base_url: separateEmbedding ? embeddingBaseUrl : "",
          embedding_api_key: separateEmbedding ? embeddingApiKey : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al guardar la configuración");
      }

      setChatOnline(Boolean(data.online));
      setChatError(data.error || null);
      setEmbOnline(Boolean(data.embeddingOnline));
      setEmbError(data.embeddingError || null);
      setDetectedChatModels(Array.isArray(data.models) ? data.models : []);
      setDetectedEmbeddingModels(
        Array.isArray(data.embeddingModels) ? data.embeddingModels : []
      );
      setAutoChatModel(data.autoDetectedChatModel || null);
      setAutoEmbeddingModel(data.autoDetectedEmbeddingModel || null);
      setSaveMessage("Configuración de IA guardada correctamente");

      if (onSaved) {
        onSaved(data);
      }
      setTimeout(() => {
        onClose();
      }, 650);
    } catch (err: any) {
      setChatError(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      const data = await res.json();
      if (data.config) {
        setProvider(data.config.provider);
        setBaseUrl(data.config.base_url);
        setApiKey(data.config.api_key);
        setChatModel(data.config.chat_model);
        setEmbeddingModel(data.config.embedding_model);
        setSeparateEmbedding(Boolean(data.config.separate_embedding));
        setEmbeddingProvider(data.config.embedding_provider);
        setEmbeddingBaseUrl(data.config.embedding_base_url || data.config.base_url);
        setEmbeddingApiKey(data.config.embedding_api_key);
      }
      setChatOnline(Boolean(data.online));
      setChatError(data.error || null);
      setDetectedChatModels(Array.isArray(data.models) ? data.models : []);
      setDetectedEmbeddingModels(
        Array.isArray(data.embeddingModels) ? data.embeddingModels : []
      );
      setSaveMessage("Restablecido a LM Studio por defecto");
      if (onSaved) {
        onSaved(data);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentPreset = presets.find((p) => p.id === provider);
  const currentEmbPreset = presets.find(
    (p) => p.id === (separateEmbedding ? embeddingProvider : provider)
  );

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(5, 8, 20, 0.78)",
        backdropFilter: "blur(8px)",
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.25rem",
      }}
    >
      <div
        className="panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "780px",
          maxHeight: "90vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          padding: "1.8rem",
          border: "1px solid rgba(99, 102, 241, 0.35)",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.65)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
            borderBottom: "1px solid var(--border-subtle)",
            paddingBottom: "1.1rem",
          }}
        >
          <div>
            <div className="pill-tag" style={{ marginBottom: "0.5rem" }}>
              <Cpu size={13} />
              <span>Configuración Multi-Backend IA</span>
            </div>
            <h2 style={{ fontSize: "1.45rem", fontWeight: 800, color: "#fff" }}>
              Proveedor de Inteligencia Artificial
            </h2>
            <p style={{ fontSize: "0.86rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
              Cambia fácilmente entre LM Studio, Ollama, llama.cpp, vLLM o APIs en la nube para clasificación y embeddings.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: "0.45rem" }}
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>
            Cargando configuración del proveedor de IA...
          </div>
        ) : (
          <>
            {/* 1. Provider Presets Selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <label
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "var(--text-main)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.45rem",
                }}
              >
                <Server size={15} style={{ color: "var(--accent-primary)" }} />
                <span>1. Selecciona el Backend Principal (Chat y Clasificación):</span>
              </label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))",
                  gap: "0.65rem",
                }}
              >
                {presets.map((p) => {
                  const active = provider === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectProvider(p.id)}
                      style={{
                        textAlign: "left",
                        padding: "0.75rem 0.9rem",
                        borderRadius: "10px",
                        border: active
                          ? "1px solid var(--accent-primary)"
                          : "1px solid var(--border-subtle)",
                        background: active
                          ? "rgba(99, 102, 241, 0.16)"
                          : "rgba(255, 255, 255, 0.03)",
                        color: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "0.4rem",
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>{p.name}</span>
                        {p.local ? (
                          <HardDrive size={13} style={{ color: "var(--accent-cyan)" }} />
                        ) : (
                          <Globe size={13} style={{ color: "#a5b4fc" }} />
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--text-muted)",
                          lineHeight: 1.3,
                        }}
                      >
                        {p.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Endpoint URL, API Key & Connection Test */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                padding: "1.1rem",
                borderRadius: "12px",
                background: "rgba(255, 255, 255, 0.025)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "0.75rem",
                  alignItems: "end",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-main)" }}>
                    URL del Servidor ({currentPreset?.name || provider}):
                  </label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="http://localhost:1234/v1"
                    className="form-input"
                    style={{ fontFamily: "monospace", fontSize: "0.88rem" }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => probeChatEndpoint(provider, baseUrl, apiKey)}
                  disabled={probingChat}
                  className="btn btn-secondary"
                  style={{ height: "40px", padding: "0 1rem", fontSize: "0.82rem" }}
                >
                  <RefreshCw
                    size={14}
                    style={{ animation: probingChat ? "spin 1s linear infinite" : "none" }}
                  />
                  <span>{probingChat ? "Probando..." : "Probar y Detectar Modelos"}</span>
                </button>
              </div>

              {/* API Key field */}
              {(currentPreset?.requiresApiKey || provider === "custom" || apiKey) && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  <label
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      color: "var(--text-main)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <Key size={14} style={{ color: "#fcd34d" }} />
                    <span>
                      API Key {currentPreset?.requiresApiKey ? "(Obligatoria)" : "(Opcional)"}:
                    </span>
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="form-input"
                    style={{ fontFamily: "monospace", fontSize: "0.86rem" }}
                  />
                </div>
              )}

              {/* Connection status banner */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  padding: "0.6rem 0.85rem",
                  borderRadius: "8px",
                  background: chatOnline
                    ? "rgba(16, 185, 129, 0.1)"
                    : "rgba(244, 63, 94, 0.1)",
                  border: chatOnline
                    ? "1px solid rgba(16, 185, 129, 0.3)"
                    : "1px solid rgba(244, 63, 94, 0.3)",
                  fontSize: "0.8rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {chatOnline ? (
                    <CheckCircle2 size={16} style={{ color: "#6ee7b7" }} />
                  ) : (
                    <AlertCircle size={16} style={{ color: "#fda4af" }} />
                  )}
                  <span style={{ color: chatOnline ? "#6ee7b7" : "#fda4af", fontWeight: 600 }}>
                    {chatOnline
                      ? `Conectado a ${currentPreset?.name || provider} (${detectedChatModels.length} modelos detectados)`
                      : chatError || "Sin conexión con el servidor seleccionado"}
                  </span>
                </div>
              </div>

              {/* Chat Model Selector */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: "var(--text-main)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  <Sparkles size={14} style={{ color: "var(--accent-primary)" }} />
                  <span>Modelo de Chat / Clasificación Bibliográfica:</span>
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
                  <select
                    value={detectedChatModels.includes(chatModel) ? chatModel : ""}
                    onChange={(e) => setChatModel(e.target.value)}
                    className="form-input"
                    style={{ fontSize: "0.85rem" }}
                  >
                    <option value="">
                      {autoChatModel
                        ? `✨ Automático (${autoChatModel})`
                        : "✨ Selección automática del servidor"}
                    </option>
                    {detectedChatModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={chatModel}
                    onChange={(e) => setChatModel(e.target.value)}
                    placeholder={
                      currentPreset?.placeholderChatModel ||
                      "O escribe el nombre del modelo (vacío = auto)"
                    }
                    className="form-input"
                    style={{ fontSize: "0.85rem", fontFamily: "monospace" }}
                  />
                </div>
              </div>
            </div>

            {/* 3. Embeddings Configuration (Unified or Separate) */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                padding: "1.1rem",
                borderRadius: "12px",
                background: "rgba(255, 255, 255, 0.025)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Layers size={16} style={{ color: "var(--accent-cyan)" }} />
                  <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fff" }}>
                    2. Configuración de Embeddings (Búsqueda y Clustering)
                  </span>
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.82rem",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={separateEmbedding}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSeparateEmbedding(checked);
                      if (checked && !embeddingBaseUrl) {
                        setEmbeddingProvider(provider);
                        setEmbeddingBaseUrl(baseUrl);
                      }
                    }}
                    style={{ width: "16px", height: "16px", accentColor: "var(--accent-primary)" }}
                  />
                  <span>Usar un proveedor distinto para Embeddings</span>
                </label>
              </div>

              {separateEmbedding && (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                      gap: "0.5rem",
                    }}
                  >
                    {presets.map((p) => {
                      const active = embeddingProvider === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectEmbeddingProvider(p.id)}
                          style={{
                            padding: "0.5rem 0.7rem",
                            borderRadius: "8px",
                            border: active
                              ? "1px solid var(--accent-cyan)"
                              : "1px solid var(--border-subtle)",
                            background: active
                              ? "rgba(6, 182, 212, 0.15)"
                              : "rgba(255, 255, 255, 0.02)",
                            color: "#fff",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: "0.75rem",
                      alignItems: "end",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                      <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-main)" }}>
                        URL Servidor de Embeddings ({currentEmbPreset?.name || embeddingProvider}):
                      </label>
                      <input
                        type="text"
                        value={embeddingBaseUrl}
                        onChange={(e) => setEmbeddingBaseUrl(e.target.value)}
                        placeholder="http://localhost:11434/v1"
                        className="form-input"
                        style={{ fontFamily: "monospace", fontSize: "0.86rem" }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        probeEmbeddingEndpoint(
                          embeddingProvider,
                          embeddingBaseUrl,
                          embeddingApiKey || apiKey
                        )
                      }
                      disabled={probingEmb}
                      className="btn btn-secondary"
                      style={{ height: "40px", padding: "0 0.9rem", fontSize: "0.8rem" }}
                    >
                      <RefreshCw
                        size={14}
                        style={{ animation: probingEmb ? "spin 1s linear infinite" : "none" }}
                      />
                      <span>Probar Embeddings</span>
                    </button>
                  </div>

                  {(currentEmbPreset?.requiresApiKey ||
                    embeddingProvider === "custom" ||
                    embeddingApiKey) && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                      <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-main)" }}>
                        API Key para Embeddings (opcional si usa la misma):
                      </label>
                      <input
                        type="password"
                        value={embeddingApiKey}
                        onChange={(e) => setEmbeddingApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="form-input"
                        style={{ fontFamily: "monospace", fontSize: "0.85rem" }}
                      />
                    </div>
                  )}

                  {embOnline !== null && (
                    <div
                      style={{
                        fontSize: "0.78rem",
                        color: embOnline ? "#6ee7b7" : "#fda4af",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                      }}
                    >
                      {embOnline ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      <span>
                        {embOnline
                          ? `Servidor de embeddings conectado (${detectedEmbeddingModels.length} modelos)`
                          : embError || "Servidor de embeddings desconectado"}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Embedding Model Selector */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-main)" }}>
                  Modelo de Embeddings Vectoriales:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
                  <select
                    value={
                      detectedEmbeddingModels.includes(embeddingModel) ? embeddingModel : ""
                    }
                    onChange={(e) => setEmbeddingModel(e.target.value)}
                    className="form-input"
                    style={{ fontSize: "0.85rem" }}
                  >
                    <option value="">
                      {autoEmbeddingModel
                        ? `✨ Automático (${autoEmbeddingModel})`
                        : "✨ Selección automática (embed/nomic/bge)"}
                    </option>
                    {detectedEmbeddingModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={embeddingModel}
                    onChange={(e) => setEmbeddingModel(e.target.value)}
                    placeholder={
                      currentEmbPreset?.placeholderEmbeddingModel ||
                      "O escribe el modelo (vacío = auto)"
                    }
                    className="form-input"
                    style={{ fontSize: "0.85rem", fontFamily: "monospace" }}
                  />
                </div>
                <p style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                  Nota: Si cambias a un modelo de embeddings con diferente dimensión vectorial que el usado anteriormente en ChromaDB, recuerda reprocesar con <code>--force</code>.
                </p>
              </div>
            </div>

            {saveMessage && (
              <div
                style={{
                  padding: "0.7rem 1rem",
                  borderRadius: "8px",
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  color: "#6ee7b7",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <CheckCircle2 size={16} />
                <span>{saveMessage}</span>
              </div>
            )}

            {/* Footer Actions */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "0.75rem",
                paddingTop: "0.5rem",
                borderTop: "1px solid var(--border-subtle)",
              }}
            >
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: "0.8rem" }}
              >
                <RotateCcw size={14} />
                <span>Restablecer a LM Studio</span>
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                  style={{ fontSize: "0.86rem" }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn btn-primary"
                  style={{ fontSize: "0.88rem", padding: "0.6rem 1.25rem" }}
                >
                  <Save size={16} />
                  <span>{saving ? "Guardando..." : "Guardar Backend de IA"}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

