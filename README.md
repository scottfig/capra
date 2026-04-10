# Capra

**Watch a real AI agent read a product's documentation and write working code — live.**

Give Capra a domain and a task. It fetches the docs from scratch, reasons through them in plain sight, and produces a complete code artifact. Every line of output is color-coded and linked back to the exact documentation page — and verbatim quote — it was derived from.

---

## How it works

1. Enter any product domain (e.g. `resend.com`, `stripe.com`) and a task in plain English.
2. A Claude agent starts cold — no prior knowledge of the product — and navigates the docs autonomously using a `fetch_page` tool.
3. The full agent trace streams live: every page fetch, every finding, every reasoning step.
4. When the agent finishes, it emits a complete code artifact alongside a source map: a line-by-line index of which documentation URL each value came from, with a verbatim excerpt.
5. The session is saved permanently. You can share it with one click.

---

## What makes it different

**Source-cited output.** The agent is instructed to annotate every code block with a `<source-map>` — a structured mapping from line numbers to the documentation URLs it read. The UI renders this as per-line color highlights: click any highlighted line and see the source page and quoted text that justified it.

**Live streaming trace.** The agent's internal log streams to the UI in real time via Server-Sent Events. You see each page fetch as it happens and the agent's single-sentence findings as they accumulate — not a spinner, not a summary after the fact.

**Cold-start authenticity.** The agent has no pre-loaded knowledge of the product. It starts at the root docs URL, discovers navigation structure, follows links, and builds understanding from scratch — the same way a developer would on their first day with an unfamiliar API.

**Persistent, shareable sessions.** Every run is stored in Postgres with full trace and output. Sessions are private by default; a single toggle makes them publicly accessible via a permanent URL.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Neon (serverless Postgres) + Drizzle ORM |
| AI | Anthropic API — `claude-sonnet-4-6` |
| Streaming | Server-Sent Events (native `ReadableStream`) |
| Deployment | Vercel Pro (120s max function duration) |

---

## Getting started

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)
- A [Neon](https://neon.tech) Postgres database (free tier works)

### Setup

```bash
git clone https://github.com/your-username/capra.git
cd capra
npm install
```

Copy the environment template and fill in your credentials:

```bash
cp .env.example .env.local
```

```
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://...
```

Push the database schema:

```bash
npm run db:push
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/sessions` | Create a session. Body: `{ domain, task }`. Returns `{ sessionId }`. |
| `GET` | `/api/sessions/[id]` | Fetch a session record. |
| `PATCH` | `/api/sessions/[id]` | Toggle `is_public`. Body: `{ is_public: boolean }`. |
| `GET` | `/api/sessions/[id]/stream` | SSE stream. Emits `step`, `step:partial`, `complete`, and `error` events. |

---

## Session schema

```ts
{
  id: uuid,
  domain: string,
  task: string,
  status: "running" | "complete" | "failed",
  trace: TraceStep[],        // agent log: thinking, fetch, sources steps
  code_output: CodeBlock[],  // code blocks with per-line source ranges
  is_public: boolean,
  created_at: timestamp,
  completed_at: timestamp,
}
```

---

## Example tasks

- `resend.com` — "Send a transactional email with an attachment"
- `stripe.com` — "Create a payment intent and handle webhook confirmation"
- `clerk.com` — "Authenticate with the API using a Bearer token"
- `linear.app` — "List all issues in a project and paginate through results"
- `upstash.com` — "Set up a webhook to receive events"

---

## License

MIT
