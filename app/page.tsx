"use client";

import SignUpModal from "@/components/SignUpModal";
import { useState } from "react";

function Nav({ onSignUp }: { onSignUp: () => void }) {
  return (
    <nav className="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-800/60 bg-[#0a0a0a]/90 px-6 py-4 backdrop-blur-sm">
      <span className="text-lg font-semibold tracking-tight text-white">Capra</span>
      <button
        onClick={onSignUp}
        className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white"
      >
        Sign Up
      </button>
    </nav>
  );
}

function Hero({ onSignUp }: { onSignUp: () => void }) {
  return (
    <section className="flex flex-col items-center px-6 py-24 text-center">
      <span className="mb-6 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-1.5 text-xs font-medium tracking-widest text-zinc-400 uppercase">
        AI · Documentation Testing
      </span>

      <h1 className="max-w-3xl text-5xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
        Watch AI navigate{" "}
        <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          your docs
        </span>
      </h1>

      <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-400">
        Give Capra a domain and a task. Claude reads the documentation, writes
        working code, and shows you exactly what it found — and what was missing.
      </p>

      <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
        <button
          onClick={onSignUp}
          className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-8 py-3.5 font-medium text-white transition-opacity hover:opacity-90"
        >
          Start for free →
        </button>
        <a
          href="/app"
          className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline transition-colors"
        >
          See a live session
        </a>
      </div>

      {/* Session preview mockup */}
      <div className="mt-16 w-full max-w-4xl overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/50">
        <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-zinc-700" />
          <span className="h-3 w-3 rounded-full bg-zinc-700" />
          <span className="h-3 w-3 rounded-full bg-zinc-700" />
          <span className="ml-3 text-xs text-zinc-500">capra.run/sessions/…</span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-zinc-800 text-left text-xs font-mono">
          {/* Trace column */}
          <div className="space-y-3 p-5">
            <p className="text-zinc-500 uppercase tracking-wider text-[10px]">Agent Trace</p>
            {[
              { icon: "◈", color: "text-blue-400", label: "web_search", value: "resend.com send email attachment" },
              { icon: "◎", color: "text-zinc-400", label: "fetch_page", value: "resend.com/docs/send-email" },
              { icon: "◈", color: "text-blue-400", label: "web_search", value: "resend attachments API reference" },
              { icon: "◎", color: "text-zinc-400", label: "fetch_page", value: "resend.com/docs/api-reference/emails" },
              { icon: "✦", color: "text-purple-400", label: "thinking", value: "Found attachment parameter…" },
              { icon: "✓", color: "text-green-400", label: "conclusion", value: "Code ready" },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`mt-0.5 shrink-0 ${step.color}`}>{step.icon}</span>
                <div>
                  <span className="text-zinc-500">{step.label} </span>
                  <span className="text-zinc-300">{step.value}</span>
                </div>
              </div>
            ))}
          </div>
          {/* Code column */}
          <div className="p-5">
            <p className="text-zinc-500 uppercase tracking-wider text-[10px] mb-3">Code Output</p>
            <pre className="leading-relaxed text-zinc-300 overflow-hidden">
              <span className="text-blue-400">import</span>
              <span className="text-zinc-300"> {"{"} Resend {"}"} </span>
              <span className="text-blue-400">from</span>
              <span className="text-green-400"> &apos;resend&apos;</span>
              {"\n\n"}
              <span className="text-blue-400">const</span>
              <span className="text-zinc-300"> resend = </span>
              <span className="text-blue-400">new</span>
              <span className="text-yellow-400"> Resend</span>
              <span className="text-zinc-300">(process.env.</span>
              <span className="text-orange-300">RESEND_API_KEY</span>
              <span className="text-zinc-300">)</span>
              {"\n\n"}
              <span className="text-blue-400">await</span>
              <span className="text-zinc-300"> resend.emails.</span>
              <span className="text-yellow-400">send</span>
              <span className="text-zinc-300">{"({"}</span>
              {"\n"}
              <span className="text-zinc-300">{"  "}</span>
              <span className="text-orange-300">from</span>
              <span className="text-zinc-300">: </span>
              <span className="text-green-400">&apos;you@example.com&apos;</span>
              <span className="text-zinc-500">,</span>
              {"\n"}
              <span className="text-zinc-300">{"  "}</span>
              <span className="text-orange-300">to</span>
              <span className="text-zinc-300">: </span>
              <span className="text-green-400">&apos;user@example.com&apos;</span>
              <span className="text-zinc-500">,</span>
              {"\n"}
              <span className="text-zinc-300">{"  "}</span>
              <span className="text-orange-300">attachments</span>
              <span className="text-zinc-300">: [{"{"} </span>
              <span className="text-orange-300">filename</span>
              <span className="text-zinc-300">, </span>
              <span className="text-orange-300">content</span>
              <span className="text-zinc-300"> {"}"}]</span>
              {"\n"}
              <span className="text-zinc-300">{"})"}</span>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Enter a domain + task",
      body: "Give Capra any product's domain and describe what you want to do with their API.",
    },
    {
      number: "02",
      title: "Watch Claude work",
      body: "See every fetch, read, and reasoning step in real time as the agent navigates the docs.",
    },
    {
      number: "03",
      title: "Get code + a report",
      body: "Receive working code and a findings report showing what documentation was found — and what was missing.",
    },
  ];

  return (
    <section className="border-t border-zinc-800 px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-12 text-center text-2xl font-semibold text-white">How it works</h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {steps.map((step) => (
            <div key={step.number} className="space-y-3">
              <span className="font-mono text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                {step.number}
              </span>
              <h3 className="text-base font-semibold text-white">{step.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: "◎",
      title: "Live agent trace",
      body: "A full step-by-step timeline of every action Claude takes — searches, fetches, and reasoning.",
    },
    {
      icon: "{ }",
      title: "Working code output",
      body: "Syntax-highlighted code, ready to copy and run against the real API.",
    },
    {
      icon: "◈",
      title: "Findings report",
      body: "A structured breakdown of what documentation existed, what was clear, and what was missing.",
    },
    {
      icon: "⟳",
      title: "Shareable sessions",
      body: "Every session gets a permanent URL. Toggle public or private and share with your team.",
    },
  ];

  return (
    <section className="border-t border-zinc-800 px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-12 text-center text-2xl font-semibold text-white">What you get</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-2"
            >
              <span className="font-mono text-blue-400">{f.icon}</span>
              <h3 className="font-semibold text-white">{f.title}</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BottomCTA({ onSignUp }: { onSignUp: () => void }) {
  return (
    <section className="border-t border-zinc-800 px-6 py-24 text-center">
      <h2 className="text-3xl font-bold text-white">Start for free</h2>
      <p className="mt-3 text-zinc-400">No credit card required.</p>
      <button
        onClick={onSignUp}
        className="mt-8 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-10 py-3.5 font-medium text-white transition-opacity hover:opacity-90"
      >
        Sign Up →
      </button>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-zinc-800 px-6 py-6 text-center">
      <p className="text-xs text-zinc-600">© {new Date().getFullYear()} Capra. All rights reserved.</p>
    </footer>
  );
}

export default function LandingPage() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Nav onSignUp={() => setShowModal(true)} />
      <Hero onSignUp={() => setShowModal(true)} />
      <HowItWorks />
      <Features />
      <BottomCTA onSignUp={() => setShowModal(true)} />
      <Footer />
      {showModal && <SignUpModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
