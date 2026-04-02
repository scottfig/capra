"use client";

import { useState } from "react";

interface Props {
  sessionId: string;
  isPublic: boolean;
}

export default function ShareButton({ sessionId, isPublic: initialIsPublic }: Props) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function makePublic() {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: true }),
      });
      if (res.ok) {
        setIsPublic(true);
        setShowModal(false);
        await copyToClipboard();
      }
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    const url = `${window.location.origin}/sessions/${sessionId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClick() {
    if (isPublic) {
      copyToClipboard();
    } else {
      setShowModal(true);
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
      >
        {isPublic ? (copied ? "Copied!" : "Copy link") : "Share"}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
            <h3 className="text-base font-semibold text-white mb-2">
              Make session public?
            </h3>
            <p className="text-sm text-zinc-400 mb-6">
              Anyone with the link will be able to view this session.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={makePublic}
                disabled={loading}
                className="flex-1 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading ? "..." : "Make public & copy link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
