import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import type { CodeBlock, Findings, TraceStep } from "./types";

export function normalizeDomain(input: string): string {
  return input
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .toLowerCase()
    .trim();
}

function parseCodeBlocks(text: string): CodeBlock[] {
  const matches = [...text.matchAll(/```(\w+)?\n([\s\S]*?)```/g)];
  return matches.map((m) => ({
    language: m[1] || "text",
    code: m[2].trim(),
  }));
}

function parseFindings(text: string): Findings | null {
  const match = text.match(/<findings>([\s\S]*?)<\/findings>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim()) as Findings;
  } catch {
    return null;
  }
}

async function appendTraceStep(sessionId: string, step: TraceStep) {
  await db.execute(
    sql`UPDATE sessions SET trace = trace || ${JSON.stringify([step])}::jsonb WHERE id = ${sessionId}`
  );
}

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
    const stream = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserPrompt(domain, task) }],
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 25 }] as unknown as Parameters<typeof client.messages.stream>[0]["tools"],
    });

    let currentThinkingText = "";
    let currentToolCallName = "";
    let currentToolCallQuery = "";
    let fullText = "";

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "text") {
          currentThinkingText = "";
        } else if (event.content_block.type === "tool_use") {
          currentToolCallName = event.content_block.name;
          currentToolCallQuery = "";
        }
      }

      if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          currentThinkingText += event.delta.text;
          fullText += event.delta.text;
          emit("step:partial", { text: event.delta.text });
        } else if (event.delta.type === "input_json_delta") {
          currentToolCallQuery += event.delta.partial_json;
        }
      }

      if (event.type === "content_block_stop") {
        if (currentThinkingText) {
          const step: TraceStep = {
            type: "thinking",
            text: currentThinkingText,
            timestamp: new Date().toISOString(),
          };
          await appendTraceStep(sessionId, step);
          emit("step", step);
          currentThinkingText = "";
        }

        if (currentToolCallName === "web_search" && currentToolCallQuery) {
          let query = "";
          try {
            const parsed = JSON.parse(currentToolCallQuery);
            query = parsed.query || currentToolCallQuery;
          } catch {
            query = currentToolCallQuery;
          }

          const step: TraceStep = {
            type: "fetch",
            url: query,
            status: 200,
            timestamp: new Date().toISOString(),
          };
          await appendTraceStep(sessionId, step);
          emit("step", step);
          currentToolCallName = "";
          currentToolCallQuery = "";
        }
      }
    }

    const codeBlocks = parseCodeBlocks(fullText);
    const findings = parseFindings(fullText);

    await db
      .update(sessions)
      .set({
        status: "complete",
        code_output: codeBlocks.length > 0 ? codeBlocks : null,
        findings: findings,
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
