import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { normalizeDomain } from "@/lib/agent/run";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { domain, task } = body as { domain: string; task: string };

  if (!domain || !task) {
    return NextResponse.json(
      { error: "domain and task are required" },
      { status: 400 }
    );
  }

  const normalizedDomain = normalizeDomain(domain);

  const [session] = await db
    .insert(sessions)
    .values({
      domain: normalizedDomain,
      task: task.trim(),
      status: "running",
    })
    .returning({ id: sessions.id });

  return NextResponse.json({ sessionId: session.id });
}
