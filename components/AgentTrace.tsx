import type { TraceStep } from "@/lib/agent/types";
import TraceStepCard from "./TraceStep";

interface Props {
  steps: TraceStep[];
  partialText?: string;
  isLive?: boolean;
}

export default function AgentTrace({ steps, partialText, isLive }: Props) {
  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div
          key={`${step.type}-${step.timestamp}-${i}`}
          className="animate-fade-in"
          style={{ animationDelay: isLive ? "0ms" : `${i * 40}ms` }}
        >
          <TraceStepCard step={step} />
        </div>
      ))}
      {partialText ? (
        <TraceStepCard
          step={{ type: "thinking", text: "", timestamp: "" }}
          isPartial
          partialText={partialText}
        />
      ) : null}
      {isLive && steps.length === 0 && !partialText ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-500">
          Agent is starting.
        </div>
      ) : null}
    </div>
  );
}
