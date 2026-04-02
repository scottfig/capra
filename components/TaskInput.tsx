"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const SUGGESTION_CHIPS = [
  "Send a transactional email with an attachment",
  "Authenticate with the API using a Bearer token",
  "Set up a webhook to receive events",
  "Handle rate limiting and retry failed requests",
  "List all resources and paginate through results",
];

export default function TaskInput() {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [task, setTask] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim() || !task.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, task }),
      });

      if (!res.ok) {
        throw new Error("Failed to create session");
      }

      const { sessionId } = await res.json();
      router.push(`/sessions/${sessionId}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl space-y-6">
      <div className="space-y-2">
        <label
          htmlFor="domain"
          className="block text-sm font-medium text-zinc-300"
        >
          Domain
        </label>
        <input
          id="domain"
          type="text"
          placeholder="resend.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="task"
          className="block text-sm font-medium text-zinc-300"
        >
          Task
        </label>
        <textarea
          id="task"
          rows={4}
          placeholder="Describe what you want the agent to accomplish..."
          value={task}
          onChange={(e) => setTask(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 resize-none"
          required
          disabled={loading}
        />
        <div className="flex flex-wrap gap-2 pt-1">
          {SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setTask(chip)}
              className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
              disabled={loading}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={loading || !domain.trim() || !task.trim()}
        className="w-full rounded-lg bg-white px-6 py-3 font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? "Starting..." : "Run"}
      </button>
    </form>
  );
}
