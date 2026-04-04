import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

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
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Private sessions that are complete are not publicly accessible
  const isInternal = _request.headers.get("x-internal") === "1";
  if (!isInternal && !session.is_public && session.status === "complete") {
    return NextResponse.json({ error: "private" }, { status: 404 });
  }

  return NextResponse.json(session);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { is_public } = body as { is_public: boolean };

  const [updated] = await db
    .update(sessions)
    .set({ is_public })
    .where(eq(sessions.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
