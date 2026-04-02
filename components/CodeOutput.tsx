"use client";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import type { CodeBlock } from "@/lib/agent/types";
import { useState } from "react";

interface Props {
  blocks: CodeBlock[];
}

export default function CodeOutput({ blocks }: Props) {
  const [copied, setCopied] = useState<number | null>(null);

  if (blocks.length === 0) {
    return (
      <p className="text-sm text-zinc-500 italic">
        No code output yet.
      </p>
    );
  }

  async function copyCode(code: string, index: number) {
    await navigator.clipboard.writeText(code);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-4">
      {blocks.map((block, i) => (
        <div key={i} className="relative group">
          <div className="flex items-center justify-between px-4 py-2 bg-zinc-800 rounded-t-lg border border-zinc-700">
            <span className="text-xs font-mono text-zinc-400">
              {block.language}
            </span>
            <button
              onClick={() => copyCode(block.code, i)}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {copied === i ? "Copied!" : "Copy"}
            </button>
          </div>
          <SyntaxHighlighter
            language={block.language}
            style={oneDark}
            customStyle={{
              margin: 0,
              borderRadius: "0 0 0.5rem 0.5rem",
              border: "1px solid rgb(63 63 70)",
              borderTop: "none",
              fontSize: "0.8125rem",
            }}
          >
            {block.code}
          </SyntaxHighlighter>
        </div>
      ))}
    </div>
  );
}
