import { db } from "@/lib/db";
import { waitlist } from "@/lib/db/schema";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const normalized = email.trim().toLowerCase();

  try {
    await db.insert(waitlist).values({ email: normalized });
  } catch (err: unknown) {
    // Unique constraint violation — already signed up, still return ok
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "23505"
    ) {
      return NextResponse.json({ ok: true });
    }
    console.error("Waitlist insert error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  // Notify — fire and forget, don't block the response
  resend.emails.send({
    from: "Capra <onboarding@resend.dev>",
    to: "scottrweston4@gmail.com",
    subject: "New Capra waitlist signup",
    text: `${normalized} just joined the waitlist.`,
  }).catch((err) => console.error("Resend notification error:", err));

  return NextResponse.json({ ok: true });
}
