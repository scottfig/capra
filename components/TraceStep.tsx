import type { TraceStep } from "@/lib/agent/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";

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

function ThinkingContent({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="text-sm text-zinc-400 leading-relaxed mb-2 last:mb-0">
            {children}
          </p>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline underline-offset-2 text-xs break-all hover:text-blue-300 transition-colors"
          >
            {children}
          </a>
        ),
        code: ({ className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className || "");
          const isBlock = !!match;
          if (isBlock) {
            return (
              <div className="my-2 rounded overflow-hidden border border-zinc-700">
                <div className="px-3 py-1 bg-zinc-800 text-xs font-mono text-zinc-400 border-b border-zinc-700">
                  {match[1]}
                </div>
                <SyntaxHighlighter
                  language={match[1]}
                  style={oneDark}
                  customStyle={{
                    margin: 0,
                    borderRadius: 0,
                    fontSize: "0.8125rem",
                  }}
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              </div>
            );
          }
          return (
            <code
              className="bg-zinc-800 text-zinc-200 px-1 py-0.5 rounded text-xs font-mono"
              {...props}
            >
              {children}
            </code>
          );
        },
        pre: ({ children }) => <>{children}</>,
      }}
    >
      {text}
    </ReactMarkdown>
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
          <div className="flex-1 min-w-0">
            <ThinkingContent text={step.text} />
            {step.sources && step.sources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-zinc-800 flex flex-wrap gap-1.5">
                {step.sources.map((url, i) => {
                  let label = url;
                  try {
                    const parsed = new URL(url);
                    label = parsed.pathname === "/" ? parsed.hostname : parsed.pathname;
                  } catch {
                    // not a valid URL, use as-is
                  }
                  return (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={url}
                      className="inline-block rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors font-mono truncate max-w-[220px]"
                    >
                      {label}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
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
          <span className="mt-0.5 text-base">📋</span>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                {step.id}
              </span>
              <span className="text-xs font-medium text-zinc-300 truncate">
                {step.section_title}
              </span>
            </div>
            <p className="text-xs font-mono text-zinc-600 break-all">{step.url}</p>
            <blockquote className="border-l-2 border-zinc-700 pl-3 text-xs text-zinc-400 leading-relaxed italic">
              {step.excerpt}
            </blockquote>
            <p className="text-xs text-zinc-500">{step.relevance}</p>
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
