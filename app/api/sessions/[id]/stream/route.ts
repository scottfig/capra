import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { runAgent } from "@/lib/agent/run";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id));

  if (!session) {
    return new Response("Session not found", { status: 404 });
  }

  if (session.status !== "running") {
    return new Response("Session is not running", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: string) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${data}\n\n`)
        );
      };

      try {
        await runAgent(id, session.domain, session.task, send);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        send("error", JSON.stringify({ message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
