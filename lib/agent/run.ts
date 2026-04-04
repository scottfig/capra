import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { fetchPage } from "./fetchPage";
import type { CodeBlock, ExtractStep, SourceRange, TraceStep } from "./types";

const SHELL_LANGUAGES = new Set(["bash", "sh", "shell", "zsh", "console"]);

export function normalizeDomain(input: string): string {
  return input
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .toLowerCase()
    .trim();
}

function parseSourceMap(
  raw: string,
  lineCount: number,
  extractsById: Map<string, ExtractStep>
): SourceRange[] {
  return raw
    .trim()
    .split("\n")
    .flatMap((line) => {
      // e.g. "3: ext_001" or "5-7: ext_002" or "3: ext_001, ext_002"
      const m = line.trim().match(/^(\d+)(?:-(\d+))?:\s*(.+)$/);
      if (!m) return [];
      const start = Number(m[1]);
      const end = Number(m[2] ?? m[1]);
      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 1 ||
        end < start ||
        start > lineCount
      ) {
        return [];
      }
      const boundedEnd = Math.min(end, lineCount);
      const ids = m[3]
        .split(",")
        .map((s) => s.trim())
        .filter((s) => /^ext_\d+$/.test(s) && extractsById.has(s));
      return ids.map((extractId) => ({ start, end: boundedEnd, extractId }));
    });
}

function cleanThinkingText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<source-map>[\s\S]*?<\/source-map>/g, "")
    .trim();
}

function sanitizePartialThinking(text: string): string {
  return text
    .replace(/```[\s\S]*$/g, "")
    .replace(/<source-map>[\s\S]*$/g, "")
    .trimStart();
}

function parseCodeBlocks(
  text: string,
  extractsById: Map<string, ExtractStep>
): CodeBlock[] {
  // Normalize: if a <source-map> appears before a code fence (any amount of whitespace
  // between them), move it to immediately after the closing fence.
  const normalized = text.replace(
    /(<source-map>[\s\S]*?<\/source-map>)([ \t\n]*)([ \t]*```)/g,
    "$3\n$1"
  );
  const pattern =
    /```(\w+)?\n([\s\S]*?)```[ \t\n]*(?:<source-map>([\s\S]*?)<\/source-map>)?/g;
  const allExtracts = [...extractsById.values()];
  const blocks: CodeBlock[] = [];
  for (const m of normalized.matchAll(pattern)) {
    const code = m[2].trim();
    const language = (m[1] || "text").toLowerCase();
    const lineCount = code === "" ? 0 : code.split("\n").length;
    const sourceRanges = parseSourceMap(m[3] ?? "", lineCount, extractsById);
    const referencedExtractIds = new Set(sourceRanges.map((range) => range.extractId));
    blocks.push({
      kind: SHELL_LANGUAGES.has(language) ? "command" : "code",
      language,
      code,
      extracts: allExtracts.filter((extract) => referencedExtractIds.has(extract.id)),
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

const RECORD_EXTRACT_TOOL: Anthropic.Tool = {
  name: "record_extract",
  description:
    "Record a specific passage from a documentation page that is directly useful for the task. Call this immediately after fetching a page, once per useful passage. Do not call speculatively — only record text you will actually use.",
  input_schema: {
    type: "object" as const,
    properties: {
      url: { type: "string", description: "The page URL this excerpt comes from" },
      section_title: {
        type: "string",
        description: "The section or heading this excerpt falls under",
      },
      excerpt: {
        type: "string",
        description: "The verbatim passage from the documentation, up to ~500 characters",
      },
      relevance: {
        type: "string",
        description: "One sentence: what task element this excerpt directly informs",
      },
    },
    required: ["url", "section_title", "excerpt", "relevance"],
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
    let extractCounter = 0;
    const extractsById = new Map<string, ExtractStep>();
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
        tools: [FETCH_PAGE_TOOL, RECORD_EXTRACT_TOOL],
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

        if (block.name === "record_extract") {
          const input = block.input as {
            url: string;
            section_title: string;
            excerpt: string;
            relevance: string;
          };
          extractCounter += 1;
          const id = `ext_${String(extractCounter).padStart(3, "0")}`;
          const extractStep: ExtractStep = {
            type: "extract",
            id,
            url: input.url,
            section_title: input.section_title,
            excerpt: input.excerpt,
            relevance: input.relevance,
            timestamp: new Date().toISOString(),
          };
          extractsById.set(id, extractStep);
          await appendTraceStep(sessionId, extractStep);
          emit("step", extractStep);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Recorded extract ${id}.`,
          });
        }
      }
      messages.push({ role: "user", content: toolResults });
    }

    const codeBlocks = parseCodeBlocks(fullText, extractsById);

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
