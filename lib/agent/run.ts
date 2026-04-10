import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { fetchPage } from "./fetchPage";
import type { CodeBlock, SourceRange, SourcesStep, TraceStep } from "./types";

const SHELL_LANGUAGES = new Set(["bash", "sh", "shell", "zsh", "console"]);

export function normalizeDomain(input: string): string {
  return input
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .toLowerCase()
    .trim();
}

function isStructuralLine(line: string): boolean {
  return /^[\s{}()\[\];,]*$/.test(line);
}

// Lines that clearly start a user-facing summary block — stop processing at these.
const SUMMARY_TRIGGERS = [
  /^i have all the information/i,
  /^now i have all/i,
  /^i now have (everything|all)/i,
  /^here'?s? (what i know|my (plan|summary|approach))/i,
  /^key facts/i,
  /^setup instructions/i,
  /^what the code does/i,
  /^a few important notes/i,
  /^before (you use|running)/i,
  /^to use this code/i,
  /^replace the following/i,
  /^⚠️/,
  /^important:/i,
  /^warning:/i,
  /^please (note|consult|see)/i,
  /^how (it|this) works/i,
  /^does this make sense/i,
];

// A line with 2+ sentence breaks is reasoning/analysis, not a log entry.
// Pattern: period/!/? followed by a space and capital letter.
function isReasoningLine(line: string): boolean {
  return (line.match(/[.!?]\s+[A-Z]/g) ?? []).length >= 2;
}

function cleanThinkingText(text: string): string {
  // Strip fenced code blocks and source-map tags
  let cleaned = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<source-map>[\s\S]*?<\/source-map>/g, "")
    .trim();

  // Strip markdown tables (lines starting with |)
  cleaned = cleaned.replace(/^(\|[^\n]*\n?)+/gm, "").trim();

  const inputLines = cleaned.split("\n");
  const outputLines: string[] = [];

  for (const line of inputLines) {
    const trimmed = line.trim();

    // Stop entirely at summary trigger phrases
    if (SUMMARY_TRIGGERS.some((re) => re.test(trimmed))) break;

    // Drop multi-sentence reasoning lines (but keep blank lines for spacing)
    if (trimmed && isReasoningLine(trimmed)) continue;

    outputLines.push(line);
  }

  return outputLines.join("\n").trim();
}

function sanitizePartialThinking(text: string): string {
  return text
    .replace(/```[\s\S]*$/g, "")
    .replace(/<source-map>[\s\S]*$/g, "")
    .trimStart();
}

function parseSourceMap(
  raw: string,
  codeLines: string[]
): SourceRange[] {
  // Each line: "LINE: URL" or "LINE-LINE: URL" or "LINE: URL | "excerpt""
  const lineCount = codeLines.length;
  const ranges: SourceRange[] = [];

  for (const line of raw.trim().split("\n")) {
    const m = line.trim().match(
      /^(\d+)(?:-(\d+))?:\s*(https?:\/\/\S+?)(?:\s*\|\s*"(.*?)")?$/
    );
    if (!m) continue;

    const start = Number(m[1]);
    const end = Number(m[2] ?? m[1]);
    const sourceUrl = m[3];
    const excerpt = m[4]; // undefined if not present

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 1 ||
      end < start ||
      start > lineCount
    ) continue;

    const boundedEnd = Math.min(end, lineCount);

    // Expand range into individual lines, skipping structural ones
    for (let ln = start; ln <= boundedEnd; ln++) {
      if (!isStructuralLine(codeLines[ln - 1])) {
        ranges.push({ start: ln, end: ln, sourceUrl, excerpt });
      }
    }
  }

  return ranges;
}

function parseCodeBlocks(text: string): CodeBlock[] {
  const pattern =
    /```(\w+)?\n([\s\S]*?)```[ \t\n]*(?:<source-map>([\s\S]*?)<\/source-map>)?/g;
  const blocks: CodeBlock[] = [];

  for (const m of text.matchAll(pattern)) {
    const code = m[2].trim();
    const language = (m[1] || "text").toLowerCase();
    const codeLines = code === "" ? [] : code.split("\n");
    const sourceRanges = parseSourceMap(m[3] ?? "", codeLines);

    blocks.push({
      kind: SHELL_LANGUAGES.has(language) ? "command" : "code",
      language,
      code,
      sourceRanges,
    });
  }

  return blocks;
}

async function appendTraceStep(sessionId: string, step: TraceStep) {
  await db.execute(
    sql`UPDATE sessions SET trace = trace || ${JSON.stringify([step])}::jsonb WHERE id = ${sessionId}`
  );
}

const FETCH_PAGE_TOOL: Anthropic.Tool = {
  name: "fetch_page",
  description:
    "Fetch the content of a documentation page by its URL. Use this to read specific pages from the product's documentation site. Navigate by fetching the root docs page first, then follow links to find what you need.",
  input_schema: {
    type: "object" as const,
    properties: {
      url: {
        type: "string",
        description: "Full URL of the documentation page to fetch",
      },
    },
    required: ["url"],
  },
};

export async function runAgent(
  sessionId: string,
  domain: string,
  task: string,
  onEvent: (event: string, data: string) => void
): Promise<void> {
  const client = new Anthropic();

  const emit = (event: string, data: unknown) => {
    onEvent(event, JSON.stringify(data));
  };

  try {
    const fetchedUrls: string[] = [];
    let fullText = "";
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: buildUserPrompt(domain, task) },
    ];

    const MAX_ITERATIONS = 15;
    let iteration = 0;
    while (true) {
      if (++iteration > MAX_ITERATIONS) {
        throw new Error(`Agent exceeded ${MAX_ITERATIONS} tool-use iterations.`);
      }
      let currentThinkingText = "";
      let currentToolCallName = "";
      let currentToolCallInput = "";

      const stream = client.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: buildSystemPrompt(),
        messages,
        tools: [FETCH_PAGE_TOOL],
      });

      for await (const event of stream) {
        if (event.type === "content_block_start") {
          if (event.content_block.type === "text") {
            currentThinkingText = "";
          } else if (event.content_block.type === "tool_use") {
            currentToolCallName = event.content_block.name;
            currentToolCallInput = "";
          }
        }

        if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            currentThinkingText += event.delta.text;
            fullText += event.delta.text;
            emit("step:partial", {
              text: sanitizePartialThinking(currentThinkingText),
            });
          } else if (event.delta.type === "input_json_delta") {
            currentToolCallInput += event.delta.partial_json;
          }
        }

        if (event.type === "content_block_stop") {
          if (currentThinkingText) {
            const cleanedText = cleanThinkingText(currentThinkingText);
            if (cleanedText) {
              const step: TraceStep = {
                type: "thinking",
                text: cleanedText,
                sources: fetchedUrls.slice(),
                timestamp: new Date().toISOString(),
              };
              await appendTraceStep(sessionId, step);
              emit("step", step);
            }
            currentThinkingText = "";
          }

          if (currentToolCallName && currentToolCallInput) {
            currentToolCallName = "";
            currentToolCallInput = "";
          }
        }
      }

      const message = await stream.finalMessage();
      messages.push({ role: "assistant", content: message.content });

      if (message.stop_reason !== "tool_use") break;

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of message.content) {
        if (block.type !== "tool_use") continue;

        if (block.name === "fetch_page") {
          const url = (block.input as { url: string }).url;
          const { text, status } = await fetchPage(url);
          fetchedUrls.push(url);
          const fetchStep: TraceStep = {
            type: "fetch",
            url,
            status,
            timestamp: new Date().toISOString(),
          };
          await appendTraceStep(sessionId, fetchStep);
          emit("step", fetchStep);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: text,
          });
        }
      }
      messages.push({ role: "user", content: toolResults });
    }

    // Emit sources step with all fetched URLs
    if (fetchedUrls.length > 0) {
      const sourcesStep: SourcesStep = {
        type: "sources",
        urls: [...new Set(fetchedUrls)],
        timestamp: new Date().toISOString(),
      };
      await appendTraceStep(sessionId, sourcesStep);
      emit("step", sourcesStep);
    }

    const codeBlocks = parseCodeBlocks(fullText);

    await db
      .update(sessions)
      .set({
        status: "complete",
        code_output: codeBlocks.length > 0 ? codeBlocks : null,
        completed_at: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    emit("complete", { sessionId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    await db
      .update(sessions)
      .set({ status: "failed" })
      .where(eq(sessions.id, sessionId));

    emit("error", { message });
  }
}
