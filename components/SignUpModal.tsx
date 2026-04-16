"use client";

import { useEffect, useRef, useState } from "react";

interface SignUpModalProps {
  onClose: () => void;
}

export default function SignUpModal({ onClose }: SignUpModalProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-300 transition-colors"
          aria-label="Close"
        >
          ✕
        </button>

        {success ? (
          <div className="space-y-3 text-center py-4">
            <div className="text-3xl">✓</div>
            <h2 className="text-xl font-semibold text-white">You&apos;re on the list.</h2>
            <p className="text-zinc-400 text-sm">We&apos;ll reach out when Capra is ready for you.</p>
            <button
              onClick={onClose}
              className="mt-4 rounded-lg border border-zinc-700 px-5 py-2 text-sm text-zinc-300 hover:border-zinc-500 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-white">Start for free</h2>
              <p className="text-zinc-400 text-sm">Join the waitlist and we&apos;ll let you know when you&apos;re in.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                ref={inputRef}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Joining..." : "Join the waitlist →"}
              </button>
            </form>

            <p className="text-center text-xs text-zinc-600">No credit card required.</p>
          </div>
        )}
      </div>
    </div>
  );
}
