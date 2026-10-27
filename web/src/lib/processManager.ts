import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

export interface ProcessProgress {
  current: number;
  total: number;
  percent: number;
  eta: string;
  book: string;
  raw?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  text: string;
  isStderr?: boolean;
}

export interface ProcessStatus {
  isRunning: boolean;
  isStopping: boolean;
  pid: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  progress: ProcessProgress | null;
  command: string | null;
  lastError: string | null;
  logsCount: number;
  wasStopped: boolean;
}

export interface StartProcessOptions {
  inputDir: string;
  force?: boolean;
  maxBooks?: number | null;
  categories?: string | null;
  overlap?: number;
  skipEmbeddings?: boolean;
}

type EventListener = (event: {
  type: "init" | "log" | "progress" | "finish" | "error" | "status" | "ping";
  [key: string]: any;
}) => void;

const MAX_LOG_LINES = 3000;
const DEFAULT_LIBROS_DIR = "/Users/josea./Libros";

class ProcessManager {
  private proc: ChildProcess | null = null;
  private isRunning: boolean = false;
  private isStopping: boolean = false;
  private wasStopped: boolean = false;
  private startedAt: string | null = null;
  private finishedAt: string | null = null;
  private exitCode: number | null = null;
  private lastError: string | null = null;
  private command: string | null = null;
  private progress: ProcessProgress | null = null;
  private logs: LogEntry[] = [];
  private listeners: Set<EventListener> = new Set();
  private stopTimeout: NodeJS.Timeout | null = null;
  private killTimeout: NodeJS.Timeout | null = null;

  constructor() {
    // If the process manager is instantiated, keep initial state
  }

  public getStatus(): ProcessStatus {
    return {
      isRunning: this.isRunning,
      isStopping: this.isStopping,
      pid: this.proc?.pid ?? null,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      exitCode: this.exitCode,
      progress: this.progress,
      command: this.command,
      lastError: this.lastError,
      logsCount: this.logs.length,
      wasStopped: this.wasStopped,
    };
  }

  public getLogs(): LogEntry[] {
    return this.logs;
  }

  public clearLogs(): void {
    if (this.isRunning) return;
    this.logs = [];
    this.progress = null;
    this.broadcast({ type: "status", status: this.getStatus() });
  }

  public subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    // Send immediate sync snapshot
    listener({
      type: "init",
      status: this.getStatus(),
      logs: this.logs,
      progress: this.progress,
    });

    return () => {
      this.listeners.delete(listener);
    };
  }

  private broadcast(event: { type: string; [key: string]: any }): void {
    for (const listener of this.listeners) {
      try {
        listener(event as any);
      } catch (err) {
        console.error("Error broadcasting to subscriber:", err);
      }
    }
  }

  private addLog(text: string, isStderr: boolean = false): LogEntry {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toLocaleTimeString(),
      text,
      isStderr,
    };

    this.logs.push(entry);
    if (this.logs.length > MAX_LOG_LINES) {
      this.logs.splice(0, this.logs.length - MAX_LOG_LINES);
    }

    this.broadcast({ type: "log", log: entry });
    return entry;
  }

  public startProcess(options: StartProcessOptions): { success: boolean; message?: string } {
    if (this.isRunning) {
      throw new Error("Ya existe un proceso de indexación en ejecución");
    }

    const { inputDir, force, maxBooks, categories, overlap, skipEmbeddings } = options;

    // Resolve directory path
    let resolvedDir = (inputDir || "").trim();
    if (!resolvedDir || resolvedDir === "." || resolvedDir === "./") {
      resolvedDir = DEFAULT_LIBROS_DIR;
    } else if (resolvedDir.startsWith("~")) {
      resolvedDir = path.join(/*turbopackIgnore: true*/ process.env.HOME || "/Users/josea.", resolvedDir.slice(1));
    } else if (!path.isAbsolute(resolvedDir)) {
      const homeCandidate = path.join(/*turbopackIgnore: true*/ process.env.HOME || "/Users/josea.", resolvedDir);
      if (fs.existsSync(/*turbopackIgnore: true*/ homeCandidate)) {
        resolvedDir = homeCandidate;
      } else if (resolvedDir.toLowerCase().includes("libro") && fs.existsSync(/*turbopackIgnore: true*/ DEFAULT_LIBROS_DIR)) {
        resolvedDir = DEFAULT_LIBROS_DIR;
      } else {
        resolvedDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "..", resolvedDir);
      }
    }

    if (!fs.existsSync(/*turbopackIgnore: true*/ resolvedDir)) {
      if (fs.existsSync(/*turbopackIgnore: true*/ DEFAULT_LIBROS_DIR)) {
        resolvedDir = DEFAULT_LIBROS_DIR;
      } else {
        throw new Error(`La carpeta no existe: ${resolvedDir}`);
      }
    }

    const projectRoot = path.resolve(process.cwd(), "..");
    const args = ["run", "epub-archive", "process", resolvedDir];

    if (force) args.push("--force");
    if (maxBooks && maxBooks > 0) args.push("--max-books", String(maxBooks));
    if (categories) args.push("--categories", categories);
    if (overlap && overlap !== 150) args.push("--overlap", String(overlap));
    if (skipEmbeddings) args.push("--skip-embeddings");

    // Reset state
    this.isRunning = true;
    this.isStopping = false;
    this.wasStopped = false;
    this.startedAt = new Date().toISOString();
    this.finishedAt = null;
    this.exitCode = null;
    this.lastError = null;
    this.progress = null;
    this.logs = [];
    this.command = `epub-archive process ${resolvedDir}`;

    this.addLog(`🚀 [SISTEMA] Iniciando pipeline: ${this.command}`);
    this.broadcast({ type: "status", status: this.getStatus() });

    try {
      // Spawn in a new process group so we can reliably kill the entire process tree
      const child = spawn("uv", args, {
        cwd: projectRoot,
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
        detached: true,
      });

      this.proc = child;

      let stdoutBuffer = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        stdoutBuffer += chunk.toString();
        const lines = stdoutBuffer.split("\n");
        stdoutBuffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          // Parse progress format: [1/80] (1.2% | ETA: 4m 30s) Procesando: book.epub
          const match = line.match(
            /\[(\d+)\/(\d+)\]\s*\(([\d.]+)%\s*\|\s*ETA:\s*([^)]+)\)\s*Procesando:\s*(.*)/
          );
          if (match) {
            this.progress = {
              current: parseInt(match[1], 10),
              total: parseInt(match[2], 10),
              percent: parseFloat(match[3]),
              eta: match[4].trim(),
              book: match[5].trim(),
              raw: line,
            };
            this.broadcast({ type: "progress", progress: this.progress });
          }

          this.addLog(line, false);
        }
      });

      let stderrBuffer = "";
      child.stderr?.on("data", (chunk: Buffer) => {
        stderrBuffer += chunk.toString();
        const lines = stderrBuffer.split("\n");
        stderrBuffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            this.addLog(line, true);
          }
        }
      });

      child.on("close", (code, signal) => {
        if (stdoutBuffer.trim()) this.addLog(stdoutBuffer.trim(), false);
        if (stderrBuffer.trim()) this.addLog(stderrBuffer.trim(), true);

        this.cleanupTimers();
        this.isRunning = false;
        this.isStopping = false;
        this.finishedAt = new Date().toISOString();
        this.exitCode = code;
        this.proc = null;

        const isSuccess = code === 0;
        const stopped = this.wasStopped || signal === "SIGINT" || signal === "SIGTERM" || code === 130;

        if (stopped) {
          this.addLog(`🛑 [SISTEMA] El proceso fue detenido por el usuario.`);
        } else if (isSuccess) {
          this.addLog(`✅ [SISTEMA] Pipeline finalizado con éxito (código 0).`);
        } else {
          this.addLog(`⚠️ [SISTEMA] Pipeline terminado con código ${code}${signal ? ` (${signal})` : ""}.`, true);
        }

        this.broadcast({
          type: "finish",
          code,
          signal,
          success: isSuccess,
          stopped,
          status: this.getStatus(),
        });
      });

      child.on("error", (err: Error) => {
        this.cleanupTimers();
        this.isRunning = false;
        this.isStopping = false;
        this.lastError = err.message;
        this.proc = null;
        this.addLog(`❌ [SISTEMA] Error crítico al ejecutar comando: ${err.message}`, true);
        this.broadcast({
          type: "error",
          message: err.message,
          status: this.getStatus(),
        });
      });

      return { success: true };
    } catch (err: any) {
      this.isRunning = false;
      this.isStopping = false;
      this.lastError = err.message;
      this.proc = null;
      throw err;
    }
  }

  private cleanupTimers() {
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }
    if (this.killTimeout) {
      clearTimeout(this.killTimeout);
      this.killTimeout = null;
    }
  }

  public stopProcess(): { success: boolean; message: string } {
    if (!this.isRunning || !this.proc || !this.proc.pid) {
      return { success: false, message: "No hay ningún proceso activo para detener." };
    }

    if (this.isStopping) {
      return { success: true, message: "La solicitud de detención ya está en curso." };
    }

    this.isStopping = true;
    this.wasStopped = true;
    const pid = this.proc.pid;

    this.addLog(`⚠️ [SISTEMA] Solicitud de parada enviada por el usuario. Interrumpiendo proceso (PID ${pid})...`);
    this.broadcast({ type: "status", status: this.getStatus() });

    // Step 1: Send SIGINT to process group so Python handles it gracefully
    try {
      process.kill(-pid, "SIGINT");
    } catch (e1) {
      try {
        this.proc.kill("SIGINT");
      } catch (e2) {
        console.error("Failed to send SIGINT to process:", e2);
      }
    }

    // Step 2: Fallback to SIGTERM after 3.5 seconds if still running
    this.stopTimeout = setTimeout(() => {
      if (this.isRunning && this.proc && this.proc.pid) {
        this.addLog(`⚠️ [SISTEMA] El proceso aún no ha finalizado; forzando cierre con SIGTERM...`);
        try {
          process.kill(-pid, "SIGTERM");
        } catch {
          try {
            this.proc?.kill("SIGTERM");
          } catch {}
        }

        // Step 3: Hard kill with SIGKILL after another 2.5 seconds
        this.killTimeout = setTimeout(() => {
          if (this.isRunning && this.proc && this.proc.pid) {
            this.addLog(`❌ [SISTEMA] Forzando terminación inmediata con SIGKILL...`, true);
            try {
              process.kill(-pid, "SIGKILL");
            } catch {
              try {
                this.proc?.kill("SIGKILL");
              } catch {}
            }
          }
        }, 2500);
      }
    }, 3500);

    return { success: true, message: "Señal de detención enviada correctamente." };
  }
}

// Global singleton to survive HMR and API route invocations
const globalForProcess = globalThis as unknown as {
  __epubProcessManager?: ProcessManager;
};

export const processManager =
  globalForProcess.__epubProcessManager || (globalForProcess.__epubProcessManager = new ProcessManager());
