import type { Findings } from "@/lib/agent/types";

interface Props {
  findings: Findings | null;
}

const confidenceColors = {
  high: "bg-green-900 text-green-300 border-green-700",
  medium: "bg-yellow-900 text-yellow-300 border-yellow-700",
  low: "bg-red-900 text-red-300 border-red-700",
};

export default function FindingsPanel({ findings }: Props) {
  if (!findings) {
    return (
      <p className="text-sm text-zinc-500 italic">
        Agent did not produce a structured findings report.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {findings.context_found.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Found
          </h4>
          <ul className="space-y-2">
            {findings.context_found.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                <div>
                  <span className="font-medium text-zinc-200">{item.label}</span>
                  {item.detail && (
                    <p className="text-zinc-400 mt-0.5">{item.detail}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {findings.context_missing.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Missing
          </h4>
          <ul className="space-y-2">
            {findings.context_missing.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-red-400 mt-0.5 shrink-0">✗</span>
                <div>
                  <span className="font-medium text-zinc-200">{item.label}</span>
                  {item.detail && (
                    <p className="text-zinc-400 mt-0.5">{item.detail}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">Confidence</span>
        <span
          className={`rounded border px-2 py-0.5 text-xs font-medium ${confidenceColors[findings.confidence]}`}
        >
          {findings.confidence.charAt(0).toUpperCase() +
            findings.confidence.slice(1)}
        </span>
      </div>

      {findings.recommendation && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            Recommendation
          </h4>
          <p className="text-sm text-zinc-300 leading-relaxed">
            {findings.recommendation}
          </p>
        </div>
      )}
    </div>
  );
}
