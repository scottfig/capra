/**
 * Citation Quality Test
 *
 * Creates sessions for a set of domain+task pairs, waits for completion,
 * then uses Claude as an LLM judge to evaluate whether each source citation
 * (excerpt → code lines) makes semantic sense.
 *
 * Usage:
 *   npx tsx scripts/test-citations.ts
 *
 * Requires the dev server to be running: npm run dev
 */

import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = "http://localhost:3000";
const POLL_TIMEOUT_MS = 300_000;

const TEST_CASES = [
  {
    domain: "resend.com",
    task: "Send a transactional email with an attachment in TypeScript",
  },
  {
    domain: "stripe.com",
    task: "Create a payment intent and handle webhooks in Node.js",
  },
  {
    domain: "docs.anthropic.com",
    task: "Stream a conversation with Claude in TypeScript",
  },
  {
    domain: "supabase.com",
    task: "Query a table with Row Level Security in JavaScript",
  },
  {
    domain: "docs.github.com",
    task: "Authenticate with a GitHub App and list repositories",
  },
];

// ---------------------------------------------------------------------------
// Types (mirrored from lib/agent/types.ts — no import path alias in scripts)
// ---------------------------------------------------------------------------

type SourceRange = {
  start: number;
  end: number;
  sourceUrl: string;
  excerpt?: string;
};

type CodeBlock = {
  kind: "code" | "command";
  language: string;
  code: string;
  sourceRanges: SourceRange[];
};

type Session = {
  id: string;
  domain: string;
  task: string;
  status: "running" | "complete" | "failed";
  code_output: CodeBlock[] | null;
};

type CitationVerdict = {
  lines: string;
  url: string;
  excerpt: string;
  plausibility: number; // 1–5
  coherent: boolean;
  reasoning: string;
};

type BlockVerdict = {
  language: string;
  citations: CitationVerdict[];
  unverifiable: string[]; // source ranges without excerpts
  uncited_lines: number[]; // non-empty lines with no source range
  overall_score: number; // 1–5 (0 = unjudged)
  summary: string;
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function createSession(domain: string, task: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain, task }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { sessionId } = (await res.json()) as { sessionId: string };
  return sessionId;
}

async function fetchSession(sessionId: string): Promise<Session> {
  const res = await fetch(`${BASE_URL}/api/sessions/${sessionId}`, {
    headers: { "x-internal": "1" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<Session>;
}

// The agent only runs when a client connects to the SSE stream endpoint.
// We consume the stream to drive execution, then fetch the final session.
async function runAndWaitForSession(sessionId: string): Promise<Session | null> {
  return new Promise(async (resolve) => {
    const timer = setTimeout(() => {
      process.stdout.write(" [timeout]\n");
      resolve(null);
    }, POLL_TIMEOUT_MS);

    try {
      const res = await fetch(`${BASE_URL}/api/sessions/${sessionId}/stream`);
      if (!res.ok || !res.body) {
        clearTimeout(timer);
        process.stdout.write(` [stream error: HTTP ${res.status}]\n`);
        resolve(null);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            const event = line.slice(7).trim();
            if (event === "complete" || event === "error") {
              process.stdout.write(event === "complete" ? " ✓\n" : " ✗\n");
            }
          }
          if (line.startsWith("data: ")) {
            process.stdout.write(".");
          }
        }
      }

      clearTimeout(timer);
      const session = await fetchSession(sessionId);
      resolve(session);
    } catch (err) {
      clearTimeout(timer);
      process.stdout.write(` [error: ${err}]\n`);
      resolve(null);
    }
  });
}

// ---------------------------------------------------------------------------
// Judge
// ---------------------------------------------------------------------------

function addLineNumbers(code: string): string {
  return code
    .split("\n")
    .map((line, i) => `${String(i + 1).padStart(3)}: ${line}`)
    .join("\n");
}

function getUncitedLines(code: string, sourceRanges: SourceRange[]): number[] {
  const lines = code.split("\n");
  const cited = new Set<number>();
  for (const range of sourceRanges) {
    for (let ln = range.start; ln <= range.end; ln++) cited.add(ln);
  }
  return lines
    .map((line, i) => ({ ln: i + 1, line }))
    .filter(({ ln, line }) => !cited.has(ln) && line.trim().length > 0)
    .map(({ ln }) => ln);
}

async function judgeCodeBlock(
  block: CodeBlock,
  client: Anthropic
): Promise<BlockVerdict> {
  const numberedCode = addLineNumbers(block.code);
  const uncited_lines = getUncitedLines(block.code, block.sourceRanges);

  const verifiable = block.sourceRanges.filter((r) => r.excerpt);
  const unverifiable = block.sourceRanges
    .filter((r) => !r.excerpt)
    .map((r) => `lines ${r.start}–${r.end} (${r.sourceUrl})`);

  if (verifiable.length === 0) {
    return {
      language: block.language,
      citations: [],
      unverifiable,
      uncited_lines,
      overall_score: 0,
      summary: "No excerpts to judge.",
    };
  }

  const citationsText = verifiable
    .map(
      (r) =>
        `Lines ${r.start}–${r.end} cited from ${r.sourceUrl}:\n  Excerpt: "${r.excerpt}"`
    )
    .join("\n\n");

  const prompt = `You are evaluating citation quality for an AI-generated code block. An AI agent read developer documentation and produced this code, attributing each range of lines to a verbatim excerpt from the docs it read.

## Generated Code (${block.language})
\`\`\`
${numberedCode}
\`\`\`

## Citations to Evaluate
${citationsText}

## Instructions
For each citation, evaluate:
- **plausibility** (1–5): Does the excerpt contain information that would lead a developer to write those specific lines? (1 = excerpt is unrelated, 5 = excerpt directly explains the code)
- **coherent** (true/false): Do the excerpt and code tell a consistent story — same API, method names, or concepts?
- **reasoning**: 1–2 sentences explaining your verdict.

Then provide:
- **overall_score** (1–5): How well-cited is this code block overall?
- **summary**: 1–2 sentences summarizing citation quality.

Respond ONLY with a JSON object in this exact shape (no markdown, no extra text):
{
  "citations": [
    {
      "lines": "X–Y",
      "url": "https://...",
      "excerpt": "...",
      "plausibility": 4,
      "coherent": true,
      "reasoning": "..."
    }
  ],
  "overall_score": 4,
  "summary": "..."
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { type: "text"; text: string }).text)
    .join("");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Judge returned no JSON:\n${text}`);

  const parsed = JSON.parse(jsonMatch[0]) as {
    citations: CitationVerdict[];
    overall_score: number;
    summary: string;
  };

  return {
    language: block.language,
    citations: parsed.citations ?? [],
    unverifiable,
    uncited_lines,
    overall_score: parsed.overall_score ?? 0,
    summary: parsed.summary ?? "",
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";

function scoreColor(score: number): string {
  if (score >= 4) return GREEN;
  if (score === 3) return YELLOW;
  return RED;
}

function printBlockVerdict(verdict: BlockVerdict, blockIndex: number) {
  const scoreStr =
    verdict.overall_score > 0
      ? `${scoreColor(verdict.overall_score)}${verdict.overall_score}/5${RESET}`
      : `${DIM}n/a${RESET}`;

  console.log(
    `\n  ${BOLD}Block ${blockIndex + 1}${RESET} (${verdict.language}) — ${scoreStr}`
  );
  console.log(`  ${verdict.summary}`);

  for (const c of verdict.citations) {
    const color =
      c.plausibility >= 4 ? GREEN : c.plausibility <= 2 ? RED : YELLOW;
    const icon = c.coherent ? "✓" : "✗";
    const excerptPreview =
      c.excerpt.length > 80 ? c.excerpt.slice(0, 80) + "…" : c.excerpt;

    console.log(
      `\n    ${color}${icon} Lines ${c.lines}${RESET}  plausibility ${color}${c.plausibility}/5${RESET}`
    );
    console.log(`      ${DIM}"${excerptPreview}"${RESET}`);
    console.log(`      ${c.reasoning}`);
  }

  if (verdict.unverifiable.length > 0) {
    console.log(
      `\n    ${DIM}⚠ No excerpt (unverifiable): ${verdict.unverifiable.join(", ")}${RESET}`
    );
  }
  if (verdict.uncited_lines.length > 0) {
    const display =
      verdict.uncited_lines.length > 10
        ? verdict.uncited_lines.slice(0, 10).join(", ") +
          ` …+${verdict.uncited_lines.length - 10} more`
        : verdict.uncited_lines.join(", ");
    console.log(`    ${DIM}⚠ Uncited lines: ${display}${RESET}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

type TestResult = {
  domain: string;
  task: string;
  sessionId: string;
  verdicts: BlockVerdict[];
};

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set in .env.local");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  console.log(`${BOLD}Capra Citation Quality Test${RESET}`);
  console.log(`${TEST_CASES.length} cases → ${BASE_URL}\n`);

  const results: TestResult[] = [];

  for (const tc of TEST_CASES) {
    console.log(`${BOLD}▶ ${tc.domain}${RESET}`);
    console.log(`  ${DIM}${tc.task}${RESET}`);

    // 1. Create session
    let sessionId: string;
    try {
      sessionId = await createSession(tc.domain, tc.task);
    } catch (err) {
      console.log(`  ${RED}✗ Failed to create session: ${err}${RESET}\n`);
      continue;
    }
    console.log(`  ${DIM}${BASE_URL}/sessions/${sessionId}${RESET}`);

    // 2. Connect to SSE stream to drive agent execution, wait for completion
    process.stdout.write("  Running");
    const session = await runAndWaitForSession(sessionId);
    console.log();

    if (!session) {
      console.log(`  ${RED}✗ Timed out${RESET}\n`);
      continue;
    }
    if (session.status === "failed") {
      console.log(`  ${RED}✗ Session failed${RESET}\n`);
      continue;
    }
    if (!session.code_output || session.code_output.length === 0) {
      console.log(`  ${YELLOW}⚠ No code output produced${RESET}\n`);
      continue;
    }

    console.log(`  ${GREEN}✓ Complete${RESET} — ${session.code_output.length} block(s)`);

    // 3. Judge each block
    const verdicts: BlockVerdict[] = [];
    for (let i = 0; i < session.code_output.length; i++) {
      try {
        const verdict = await judgeCodeBlock(session.code_output[i], client);
        verdicts.push(verdict);
        printBlockVerdict(verdict, i);
      } catch (err) {
        console.log(`  ${RED}✗ Judge error on block ${i + 1}: ${err}${RESET}`);
      }
    }

    results.push({ domain: tc.domain, task: tc.task, sessionId, verdicts });
    console.log();
  }

  // Summary table
  if (results.length === 0) return;

  console.log(`\n${"─".repeat(64)}`);
  console.log(`${BOLD}Summary${RESET}\n`);

  for (const r of results) {
    const scores = r.verdicts
      .map((v) => v.overall_score)
      .filter((s) => s > 0);
    const avg =
      scores.length > 0
        ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
        : "n/a";
    const color = scores.length > 0 ? scoreColor(Math.round(Number(avg))) : DIM;

    console.log(
      `  ${color}${String(avg).padStart(3)}/5${RESET}  ${BOLD}${r.domain}${RESET}`
    );
    console.log(`       ${DIM}${r.task}${RESET}`);
    console.log(`       ${DIM}${BASE_URL}/sessions/${r.sessionId}${RESET}`);
  }
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
