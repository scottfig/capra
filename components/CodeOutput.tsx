"use client";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import type { CodeBlock, ExtractStep } from "@/lib/agent/types";
import { useState } from "react";

interface Props {
  blocks: CodeBlock[];
}

const PALETTE = [
  { bg: "rgba(59,130,246,0.10)",  bgActive: "rgba(59,130,246,0.20)",  border: "rgba(59,130,246,0.40)",  borderActive: "rgba(59,130,246,0.80)",  dot: "#3b82f6" },
  { bg: "rgba(139,92,246,0.10)",  bgActive: "rgba(139,92,246,0.20)",  border: "rgba(139,92,246,0.40)",  borderActive: "rgba(139,92,246,0.80)",  dot: "#8b5cf6" },
  { bg: "rgba(20,184,166,0.10)",  bgActive: "rgba(20,184,166,0.20)",  border: "rgba(20,184,166,0.40)",  borderActive: "rgba(20,184,166,0.80)",  dot: "#14b8a6" },
  { bg: "rgba(245,158,11,0.10)",  bgActive: "rgba(245,158,11,0.20)",  border: "rgba(245,158,11,0.40)",  borderActive: "rgba(245,158,11,0.80)",  dot: "#f59e0b" },
  { bg: "rgba(244,63,94,0.10)",   bgActive: "rgba(244,63,94,0.20)",   border: "rgba(244,63,94,0.40)",   borderActive: "rgba(244,63,94,0.80)",   dot: "#f43f5e" },
];

function formatBlockLabel(block: CodeBlock): string {
  if (block.kind === "command") return "command";
  return block.language || "code";
}

function SourceCard({ extract, dot }: { extract: ExtractStep; dot: string }) {
  let pathLabel = extract.url;
  try {
    const parsed = new URL(extract.url);
    pathLabel = parsed.pathname === "/" ? parsed.hostname : parsed.pathname;
  } catch {
    // keep full URL
  }
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: dot }}
          />
          <span className="text-xs font-semibold text-zinc-200 leading-snug truncate">
            {extract.section_title}
          </span>
        </div>
        <a
          href={extract.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:text-blue-400 font-mono shrink-0 underline underline-offset-2"
        >
          {pathLabel}
        </a>
      </div>
      <blockquote className="border-l-2 border-zinc-700 pl-2.5 text-xs text-zinc-400 leading-relaxed italic">
        {extract.excerpt}
      </blockquote>
    </div>
  );
}

export default function CodeOutput({ blocks }: Props) {
  const [copied, setCopied] = useState<number | null>(null);
  const [activeEntry, setActiveEntry] = useState<{
    extractId: string;
    blockIndex: number;
    colorIndex: number;
  } | null>(null);
  const [hoveredEntry, setHoveredEntry] = useState<{
    extractId: string;
    blockIndex: number;
    colorIndex: number;
  } | null>(null);

  if (blocks.length === 0) {
    return <p className="text-sm text-zinc-500 italic">No artifact output yet.</p>;
  }

  async function copyCode(code: string, index: number) {
    await navigator.clipboard.writeText(code);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Provenance
          </span>
          <span className="inline-flex items-center gap-2 text-xs text-zinc-300">
            <span className="h-3 w-3 rounded-sm border border-blue-400/60 bg-blue-500/15" />
            Documentation-grounded
          </span>
          <span className="inline-flex items-center gap-2 text-xs text-zinc-400">
            <span className="h-3 w-3 rounded-sm border border-zinc-700 bg-zinc-800/70" />
            Uncited synthesis
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          Hover highlighted lines to preview the supporting excerpt. Click a highlighted range to pin its source.
        </p>
      </div>
      {blocks.map((block, i) => {
        const hasRanges = block.sourceRanges && block.sourceRanges.length > 0;

        // Assign palette color to each unique extractId in order of first appearance
        const extractColorIndex = new Map<string, number>();
        for (const r of block.sourceRanges ?? []) {
          if (!extractColorIndex.has(r.extractId)) {
            extractColorIndex.set(r.extractId, extractColorIndex.size % PALETTE.length);
          }
        }

        // Build line → { extractId, colorIndex } lookup
        const lineMap = new Map<number, { extractId: string; colorIndex: number }>();
        for (const r of block.sourceRanges ?? []) {
          const ci = extractColorIndex.get(r.extractId)!;
          for (let ln = r.start; ln <= r.end; ln++) {
            lineMap.set(ln, { extractId: r.extractId, colorIndex: ci });
          }
        }

        const extractsMap = new Map(block.extracts?.map((e) => [e.id, e]) ?? []);
        const activeForThisBlock =
          activeEntry?.blockIndex === i ? activeEntry : null;
        const activeExtract = activeForThisBlock
          ? extractsMap.get(activeForThisBlock.extractId)
          : null;

        const hoveredForThisBlock =
          hoveredEntry?.blockIndex === i ? hoveredEntry : null;
        // Only show hover card if not already pinned to the same extract
        const hoverExtract =
          hoveredForThisBlock &&
          hoveredForThisBlock.extractId !== activeForThisBlock?.extractId
            ? extractsMap.get(hoveredForThisBlock.extractId)
            : null;

        return (
          <div
            key={i}
            className={`rounded-lg overflow-hidden border ${
              hasRanges ? "border-zinc-600" : "border-zinc-700"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-800 border-b border-zinc-700/50">
              <span className="text-xs font-mono text-zinc-400">
                {formatBlockLabel(block)}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500">
                  {hasRanges ? `${block.sourceRanges.length} cited range${block.sourceRanges.length === 1 ? "" : "s"}` : "No direct doc citations"}
                </span>
                <button
                  onClick={() => copyCode(block.code, i)}
                  className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  {copied === i ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Code with per-line source highlighting */}
            <SyntaxHighlighter
              language={block.language}
              style={oneDark}
              wrapLines={true}
              showLineNumbers={true}
              lineNumberStyle={{ display: "none" }}
              lineProps={(lineNumber) => {
                const entry = lineMap.get(lineNumber);
                if (!entry) return {
                  style: { display: "block" },
                  onMouseEnter: () => setHoveredEntry(null),
                };
                const palette = PALETTE[entry.colorIndex];
                const isActive =
                  activeForThisBlock?.extractId === entry.extractId;
                const isHovered =
                  hoveredForThisBlock?.extractId === entry.extractId;
                return {
                  style: {
                    display: "block",
                    backgroundColor: isActive ? palette.bgActive : palette.bg,
                    borderLeft: `2px solid ${isActive ? palette.borderActive : palette.border}`,
                    cursor: "pointer",
                    transition: "background-color 0.1s",
                    outline: isHovered && !isActive ? `1px solid ${palette.borderActive}` : undefined,
                    outlineOffset: "-1px",
                  },
                  onClick: () =>
                    setActiveEntry(
                      isActive
                        ? null
                        : {
                            extractId: entry.extractId,
                            blockIndex: i,
                            colorIndex: entry.colorIndex,
                          }
                    ),
                  onMouseEnter: () =>
                    setHoveredEntry({
                      extractId: entry.extractId,
                      blockIndex: i,
                      colorIndex: entry.colorIndex,
                    }),
                  onMouseLeave: () => setHoveredEntry(null),
                };
              }}
              customStyle={{
                margin: 0,
                borderRadius: 0,
                border: "none",
                fontSize: "0.8125rem",
              }}
            >
              {block.code}
            </SyntaxHighlighter>

            {/* Hover preview panel */}
            {hoverExtract && hoveredForThisBlock && (
              <div className="border-t border-zinc-700/60 bg-zinc-900/40 p-3 space-y-2 pointer-events-none">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Source preview
                </span>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: PALETTE[hoveredForThisBlock.colorIndex].dot }}
                      />
                      <span className="text-xs font-semibold text-zinc-200 leading-snug truncate">
                        {hoverExtract.section_title}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-500 font-mono shrink-0">
                      click to pin
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                    {hoverExtract.excerpt}
                  </p>
                </div>
              </div>
            )}

            {/* Source panel for the active (pinned) line */}
            {activeExtract && activeForThisBlock && (
              <div className="border-t border-zinc-700/60 bg-zinc-900/40 p-3 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Source
                  </span>
                  <button
                    onClick={() => setActiveEntry(null)}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <SourceCard
                  extract={activeExtract}
                  dot={PALETTE[activeForThisBlock.colorIndex].dot}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
