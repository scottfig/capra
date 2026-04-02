import type { TraceStep } from "@/lib/agent/types";

interface Props {
  step: TraceStep;
  isPartial?: boolean;
  partialText?: string;
}

function StatusBadge({ status }: { status: number }) {
  const color =
    status >= 200 && status < 300
      ? "bg-green-900 text-green-300"
      : status >= 400
      ? "bg-red-900 text-red-300"
      : "bg-yellow-900 text-yellow-300";
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-mono ${color}`}>
      {status}
    </span>
  );
}

export default function TraceStepCard({ step, isPartial, partialText }: Props) {
  if (isPartial) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-base">💭</span>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {partialText}
            <span className="ml-0.5 inline-block w-0.5 h-3.5 bg-zinc-400 animate-pulse align-middle" />
          </p>
        </div>
      </div>
    );
  }

  if (step.type === "thinking") {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-base">💭</span>
          <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">
            {step.text}
          </p>
        </div>
      </div>
    );
  }

  if (step.type === "fetch") {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-base">🔍</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-mono text-zinc-200 break-all">
                {step.url}
              </span>
              <StatusBadge status={step.status} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step.type === "extract") {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-base">📄</span>
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-xs font-mono text-zinc-500 break-all">
              {step.url}
            </p>
            {step.found.length > 0 && (
              <ul className="space-y-1">
                {step.found.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-sm">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span className="text-zinc-300">{item}</span>
                  </li>
                ))}
              </ul>
            )}
            {step.missing.length > 0 && (
              <ul className="space-y-1">
                {step.missing.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-sm">
                    <span className="text-red-400 mt-0.5">✗</span>
                    <span className="text-zinc-400">{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step.type === "conclusion") {
    return (
      <div className="rounded-lg border border-zinc-600 bg-zinc-800 p-4">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-base">✅</span>
          <p className="text-sm font-medium text-zinc-100 leading-relaxed whitespace-pre-wrap">
            {step.text}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
