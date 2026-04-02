import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import SessionView from "@/components/SessionView";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SessionPage({ params }: Props) {
  const { id } = await params;

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id));

  if (!session) {
    notFound();
  }

  // Private completed sessions are not accessible
  if (!session.is_public && session.status === "complete") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold text-white">
            This session is private.
          </h1>
          <p className="text-sm text-zinc-500">
            The owner has not made this session public.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen flex flex-col">
      <SessionView session={session} />
    </main>
  );
}
