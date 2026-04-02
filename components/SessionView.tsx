"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@/lib/db/schema";
import type { CodeBlock, Findings, TraceStep } from "@/lib/agent/types";
import AgentTrace from "./AgentTrace";
import CodeOutput from "./CodeOutput";
import FindingsPanel from "./FindingsPanel";
import ShareButton from "./ShareButton";

interface Props {
  session: Session;
}

type ActiveTab = "code" | "findings";

export default function SessionView({ session }: Props) {
  const [steps, setSteps] = useState<TraceStep[]>(
    (session.trace as TraceStep[]) ?? []
  );
  const [codeBlocks, setCodeBlocks] = useState<CodeBlock[]>(
    (session.code_output as CodeBlock[]) ?? []
  );
  const [findings, setFindings] = useState<Findings | null>(
    (session.findings as Findings) ?? null
  );
  const [status, setStatus] = useState(session.status);
  const [partialText, setPartialText] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("code");
  const [errorMessage, setErrorMessage] = useState("");
  const [fetchCount, setFetchCount] = useState(
    (session.trace as TraceStep[] | null)?.filter((s) => s.type === "fetch")
      .length ?? 0
  );
  const traceEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session.status !== "running") return;

    const eventSource = new EventSource(
      `/api/sessions/${session.id}/stream`
    );

    eventSource.addEventListener("step", (e) => {
      const step = JSON.parse(e.data) as TraceStep;
      setSteps((prev) => [...prev, step]);
      setPartialText("");
      if (step.type === "fetch") {
        setFetchCount((n) => n + 1);
      }
    });

    eventSource.addEventListener("step:partial", (e) => {
      const { text } = JSON.parse(e.data) as { text: string };
      setPartialText((prev) => prev + text);
    });

    eventSource.addEventListener("complete", async () => {
      eventSource.close();
      setPartialText("");
      setStatus("complete");
      // Reload session to get final code_output + findings
      const res = await fetch(`/api/sessions/${session.id}`, {
        headers: { "x-internal": "1" },
      });
      if (res.ok) {
        const updated = await res.json() as Session;
        setCodeBlocks((updated.code_output as CodeBlock[]) ?? []);
        setFindings((updated.findings as Findings) ?? null);
      }
      setActiveTab("code");
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

  // Auto-scroll trace panel
  useEffect(() => {
    traceEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [steps, partialText]);

  const isLive = status === "running";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-white truncate">
              {session.domain}
            </h1>
            {isLive && (
              <span className="flex items-center gap-1.5 text-xs text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Running
              </span>
            )}
            {status === "failed" && (
              <span className="text-xs text-red-400">Failed</span>
            )}
          </div>
          <p className="text-sm text-zinc-400 mt-0.5 line-clamp-2">
            {session.task}
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            {status === "complete" && session.completed_at
              ? `Completed · ${fetchCount} fetches`
              : isLive
              ? `${fetchCount} fetches so far...`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ShareButton sessionId={session.id} isPublic={session.is_public} />
          <button
            onClick={() =>
              navigator.clipboard.writeText(window.location.href)
            }
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
          >
            Copy
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mx-6 mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {errorMessage} The partial trace is saved below.
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 min-h-0 divide-x divide-zinc-800">
        {/* Left: Trace */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-4">
            Agent Trace
          </h2>
          <AgentTrace steps={steps} partialText={partialText} isLive={isLive} />
          <div ref={traceEndRef} />
        </div>

        {/* Right: Code + Findings */}
        <div className="w-[480px] shrink-0 flex flex-col min-h-0">
          {/* Tabs */}
          <div className="flex border-b border-zinc-800">
            {(["code", "findings"] as ActiveTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "text-white border-b-2 border-white -mb-px"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab === "code" ? "Code Output" : "Findings"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "code" ? (
              <CodeOutput blocks={codeBlocks} />
            ) : (
              <FindingsPanel findings={findings} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
