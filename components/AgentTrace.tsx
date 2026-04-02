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
          key={i}
          className="animate-fade-in"
          style={{ animationDelay: isLive ? "0ms" : `${i * 60}ms` }}
        >
          <TraceStepCard step={step} />
        </div>
      ))}
      {partialText && (
        <TraceStepCard
          step={{ type: "thinking", text: "", timestamp: "" }}
          isPartial
          partialText={partialText}
        />
      )}
      {isLive && !partialText && steps.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <span className="inline-block w-2 h-2 bg-zinc-500 rounded-full animate-pulse" />
          Agent is starting...
        </div>
      )}
    </div>
  );
}
