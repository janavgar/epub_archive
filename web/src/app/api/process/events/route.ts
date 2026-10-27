import { processManager } from "@/lib/processManager";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let cleanupSubscription: (() => void) | null = null;
  let pingInterval: NodeJS.Timeout | null = null;
  let isClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (data: any) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          isClosed = true;
          safeCleanup();
        }
      };

      const safeCleanup = () => {
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
        if (cleanupSubscription) {
          cleanupSubscription();
          cleanupSubscription = null;
        }
      };

      cleanupSubscription = processManager.subscribe((event) => {
        sendEvent(event);
      });

      // Periodic ping to keep SSE connection alive
      pingInterval = setInterval(() => {
        sendEvent({ type: "ping", timestamp: Date.now() });
      }, 15000);
    },
    cancel() {
      isClosed = true;
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      if (cleanupSubscription) {
        cleanupSubscription();
        cleanupSubscription = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
