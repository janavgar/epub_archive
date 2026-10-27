"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { ProcessStatus, ProcessProgress, LogEntry } from "@/lib/processManager";

interface ProcessContextValue {
  status: ProcessStatus | null;
  isRunning: boolean;
  isStopping: boolean;
  progress: ProcessProgress | null;
  logs: LogEntry[];
  lastFinish: { success: boolean; code: number; stopped?: boolean } | null;
  isLogDrawerOpen: boolean;
  setIsLogDrawerOpen: (open: boolean) => void;
  toggleLogDrawer: () => void;
  startProcess: (options: {
    inputDir: string;
    force?: boolean;
    maxBooks?: number | "";
    categories?: string;
    overlap?: number;
    skipEmbeddings?: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
  stopProcess: () => Promise<{ success: boolean; message: string }>;
  clearLogs: () => void;
}

const ProcessContext = createContext<ProcessContextValue | undefined>(undefined);

export function ProcessProvider({
  children,
  onProcessFinished,
}: {
  children: React.ReactNode;
  onProcessFinished?: () => void;
}) {
  const [status, setStatus] = useState<ProcessStatus | null>(null);
  const [progress, setProgress] = useState<ProcessProgress | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastFinish, setLastFinish] = useState<{ success: boolean; code: number; stopped?: boolean } | null>(null);
  const [isLogDrawerOpen, setIsLogDrawerOpen] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const onProcessFinishedRef = useRef(onProcessFinished);
  onProcessFinishedRef.current = onProcessFinished;

  // Connect to SSE stream
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      es = new EventSource("/api/process/events");
      eventSourceRef.current = es;

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "ping") return;

          if (data.type === "init") {
            setStatus(data.status);
            setProgress(data.progress || null);
            setLogs(data.logs || []);
            if (data.status?.finishedAt) {
              setLastFinish({
                success: data.status.exitCode === 0,
                code: data.status.exitCode,
                stopped: data.status.wasStopped,
              });
            }
          } else if (data.type === "status") {
            setStatus(data.status);
            if (data.status?.progress) {
              setProgress(data.status.progress);
            }
          } else if (data.type === "progress") {
            setProgress(data.progress);
          } else if (data.type === "log") {
            setLogs((prev) => {
              // Avoid duplicate logs if already present
              if (prev.length > 0 && prev[prev.length - 1].id === data.log.id) {
                return prev;
              }
              const next = [...prev, data.log];
              return next.length > 3000 ? next.slice(next.length - 3000) : next;
            });
          } else if (data.type === "finish") {
            setLastFinish({
              success: data.success,
              code: data.code,
              stopped: data.stopped,
            });
            if (data.status) {
              setStatus(data.status);
            } else {
              setStatus((prev) => (prev ? { ...prev, isRunning: false, isStopping: false, exitCode: data.code } : null));
            }
            if (onProcessFinishedRef.current) {
              onProcessFinishedRef.current();
            }
          } else if (data.type === "error") {
            if (data.status) {
              setStatus(data.status);
            }
          }
        } catch (err) {
          console.error("Error parsing SSE message:", err);
        }
      };

      es.onerror = () => {
        if (es) {
          es.close();
        }
        // Try reconnecting in 3 seconds
        reconnectTimeout = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (es) es.close();
      eventSourceRef.current = null;
    };
  }, []);

  const startProcess = useCallback(
    async (options: {
      inputDir: string;
      force?: boolean;
      maxBooks?: number | "";
      categories?: string;
      overlap?: number;
      skipEmbeddings?: boolean;
    }) => {
      setLastFinish(null);
      setProgress(null);
      setLogs([]);

      try {
        const payload: any = {
          input_dir: options.inputDir.trim(),
          force: Boolean(options.force),
          overlap: options.overlap || 150,
          skip_embeddings: Boolean(options.skipEmbeddings),
        };
        if (options.maxBooks !== "" && Number(options.maxBooks) > 0) {
          payload.max_books = Number(options.maxBooks);
        }
        if (options.categories?.trim()) {
          payload.categories = options.categories.trim();
        }

        const res = await fetch("/api/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Error ${res.status}`);
        }

        if (data.status) {
          setStatus(data.status);
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || "Error al iniciar el proceso" };
      }
    },
    []
  );

  const stopProcess = useCallback(async () => {
    try {
      const res = await fetch("/api/process/stop", {
        method: "POST",
      });
      const data = await res.json();
      return {
        success: data.success,
        message: data.message || "Solicitud de parada enviada",
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "Error al comunicarse con el servidor para detener el proceso",
      };
    }
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
    setProgress(null);
  }, []);

  const toggleLogDrawer = useCallback(() => {
    setIsLogDrawerOpen((prev) => !prev);
  }, []);

  const isRunning = Boolean(status?.isRunning);
  const isStopping = Boolean(status?.isStopping);

  return (
    <ProcessContext.Provider
      value={{
        status,
        isRunning,
        isStopping,
        progress,
        logs,
        lastFinish,
        isLogDrawerOpen,
        setIsLogDrawerOpen,
        toggleLogDrawer,
        startProcess,
        stopProcess,
        clearLogs,
      }}
    >
      {children}
    </ProcessContext.Provider>
  );
}

export function useProcess() {
  const context = useContext(ProcessContext);
  if (!context) {
    throw new Error("useProcess must be used within a ProcessProvider");
  }
  return context;
}
