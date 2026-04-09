"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@/lib/db/schema";
import type { CodeBlock, TraceStep } from "@/lib/agent/types";
import AgentTrace from "./AgentTrace";
import CodeOutput from "./CodeOutput";
import ShareButton from "./ShareButton";

interface Props {
  session: Session;
}

export default function SessionView({ session }: Props) {
  const [steps, setSteps] = useState<TraceStep[]>(
    (session.trace as TraceStep[]) ?? []
  );
  const [codeBlocks, setCodeBlocks] = useState<CodeBlock[]>(
    (session.code_output as CodeBlock[]) ?? []
  );
  const [status, setStatus] = useState(session.status);
  const [partialText, setPartialText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showHighlights, setShowHighlights] = useState(true);
  const [traceWidth, setTraceWidth] = useState(48);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tracePanelRef = useRef<HTMLDivElement>(null);
  const outputPanelRef = useRef<HTMLDivElement>(null);
  const [isLg, setIsLg] = useState(false);
  const traceEndRef = useRef<HTMLDivElement>(null);
  const fetchCount = steps.filter((step) => step.type === "fetch").length;

  useEffect(() => {
    if (session.status !== "running") return;

    const eventSource = new EventSource(`/api/sessions/${session.id}/stream`);

    eventSource.addEventListener("step", (e) => {
      try {
        const step = JSON.parse(e.data) as TraceStep;
        setSteps((current) => [...current, step]);
        setPartialText("");
      } catch { /* ignore */ }
    });

    eventSource.addEventListener("step:partial", (e) => {
      try {
        const { text } = JSON.parse((e as MessageEvent).data) as { text: string };
        setPartialText(text);
      } catch {
        setPartialText("");
      }
    });

    eventSource.addEventListener("complete", async () => {
      eventSource.close();
      setStatus("complete");
      const res = await fetch(`/api/sessions/${session.id}`, {
        headers: { "x-internal": "1" },
      });
      if (res.ok) {
        const updated = await res.json() as Session;
        setSteps((updated.trace as TraceStep[]) ?? []);
        setCodeBlocks((updated.code_output as CodeBlock[]) ?? []);
      }
      setPartialText("");
    });

    eventSource.addEventListener("error", (e) => {
      try {
        const { message } = JSON.parse((e as MessageEvent).data) as { message: string };
        setErrorMessage(message);
      } catch {
        setErrorMessage("The agent encountered an error.");
      }
      setStatus("failed");
      eventSource.close();
      setPartialText("");
    });

    return () => eventSource.close();
  }, [session.id, session.status]);

  useEffect(() => {
    traceEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [steps, partialText]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsLg(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsLg(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = Math.min(Math.max(((e.clientX - rect.left) / rect.width) * 100, 20), 80);
      // Mutate DOM directly — no React re-render during drag
      if (tracePanelRef.current) tracePanelRef.current.style.width = `${pct}%`;
      if (outputPanelRef.current) outputPanelRef.current.style.width = `${100 - pct}%`;
    }
    function onMouseUp(e: MouseEvent) {
      if (!isDragging.current || !containerRef.current) return;
      isDragging.current = false;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = Math.min(Math.max(((e.clientX - rect.left) / rect.width) * 100, 20), 80);
      setTraceWidth(pct); // commit to React state once on release
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-sm text-zinc-400">{session.domain}</span>
          <span className="text-zinc-700">·</span>
          <span className="text-sm text-zinc-300 truncate">{session.task}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {status === "running" && (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Running
            </span>
          )}
          {status === "complete" && (
            <span className="text-xs text-zinc-500">Complete</span>
          )}
          {status === "failed" && (
            <span className="text-xs text-red-400">Failed</span>
          )}
          <ShareButton sessionId={session.id} isPublic={session.is_public} />
        </div>
      </div>

      {/* Body */}
      <div ref={containerRef} className="flex flex-1 min-h-0 flex-col lg:flex-row">
        <div
          ref={tracePanelRef}
          className="flex min-h-0 flex-col border-b border-zinc-800 lg:border-b-0 w-full"
          style={isLg ? { width: `${traceWidth}%` } : undefined}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Agent Trace
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                {status === "complete"
                  ? `${fetchCount} page${fetchCount === 1 ? "" : "s"} fetched`
                  : status === "running"
                  ? `${fetchCount} page${fetchCount === 1 ? "" : "s"} fetched so far`
                  : "Trace captured until failure"}
              </p>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {errorMessage ? (
              <div className="mb-4 rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </div>
            ) : null}
            <AgentTrace
              steps={steps}
              partialText={partialText}
              isLive={status === "running"}
            />
            <div ref={traceEndRef} />
          </div>
        </div>

        {/* Draggable divider — desktop only */}
        <div
          className="hidden lg:flex items-center justify-center w-1 shrink-0 bg-zinc-800 hover:bg-zinc-600 cursor-col-resize transition-colors select-none group"
          onMouseDown={(e) => { e.preventDefault(); isDragging.current = true; }}
        >
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-[3px]">
            <span className="w-[3px] h-[3px] rounded-full bg-zinc-400" />
            <span className="w-[3px] h-[3px] rounded-full bg-zinc-400" />
            <span className="w-[3px] h-[3px] rounded-full bg-zinc-400" />
          </div>
        </div>

        <div
          ref={outputPanelRef}
          className="flex min-h-0 flex-col w-full"
          style={isLg ? { width: `${100 - traceWidth}%` } : undefined}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Output
            </h2>
            <button
              onClick={() => setShowHighlights(h => !h)}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {showHighlights ? "Hide highlights" : "Show highlights"}
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {status === "running" && codeBlocks.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <div className="h-6 w-6 rounded-full border-2 border-zinc-700 border-t-zinc-400 animate-spin" />
                <p className="text-sm text-zinc-500">
                  {fetchCount > 0
                    ? "Reading the docs and assembling the artifact..."
                    : "Agent is starting..."}
                </p>
              </div>
            ) : null}
            {codeBlocks.length > 0 ? <CodeOutput blocks={codeBlocks} showHighlights={showHighlights} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
