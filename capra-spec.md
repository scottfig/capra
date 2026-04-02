# Capra — Implementation Spec

## What this is

A tool that lets anyone enter a domain and a task prompt, then watches a real AI agent attempt that task against the site's documentation — cold, from scratch, exactly as a developer's coding agent would. The session streams live and is saved permanently as a shareable replay.

The output is three things equally:
1. A live replay of exactly what the agent fetched, read, and reasoned
2. The final code the agent produced
3. A breakdown of what the agent found vs. what it couldn't find in the docs

This is not a simulation. It is actual agent behavior, made visible.

---

## Core user flow

1. User visits the app
2. Enters a domain (e.g. `resend.com`)
3. Enters a free-text task prompt (e.g. "Send a transactional email with an attachment to a verified domain")
4. Hits run
5. Watches the agent work live — every fetch, every read, every reasoning step streams in real time
6. Session ends with: the code the agent wrote + a breakdown of found vs. missing context
7. Session is saved permanently at a unique URL
8. Private by default — owner can toggle to shareable

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSE streaming, API routes, easy Vercel deploy |
| Styling | Tailwind CSS | Fast to build |
| Database | Neon (Postgres) via `@neondatabase/serverless` | Serverless-optimized, stores traces as JSONB |
| ORM | Drizzle ORM | Lightweight, works well with Neon |
| Agent | Anthropic API — `claude-sonnet-4-6` with `web_search_20260209` | Full tool-use trace observable, web search built in |
| Streaming | Server-Sent Events (SSE) | Real-time step-by-step replay during live run |
| Deployment | Vercel Pro (Fluid Compute, `maxDuration: 120`) | Handles long-running agent sessions |

---

## Environment variables

```
ANTHROPIC_API_KEY=
DATABASE_URL=
```

---

## Database schema

```sql
-- One row per session (one task run against one domain)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  task TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running', -- running | complete | failed
  trace JSONB NOT NULL DEFAULT '[]',
  code_output TEXT,
  findings JSONB,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

### Trace structure

The `trace` column stores an ordered array of steps. Each step is one of four types:

```ts
type TraceStep =
  | {
      type: "thinking";
      text: string;
      timestamp: string;
    }
  | {
      type: "fetch";
      url: string;
      status: number;         // HTTP status code
      timestamp: string;
    }
  | {
      type: "extract";
      url: string;
      found: string[];        // bullet list of what the agent extracted
      missing: string[];      // what it looked for but couldn't find
      timestamp: string;
    }
  | {
      type: "conclusion";
      text: string;           // agent's summary of what it learned
      timestamp: string;
    }
```

### Findings structure

The `findings` column stores the post-session breakdown:

```ts
type Findings = {
  task_understood: boolean;
  context_found: FindingItem[];
  context_missing: FindingItem[];
  confidence: "high" | "medium" | "low"; // agent's self-assessed confidence
  recommendation: string;                 // one paragraph for the site owner
}

type FindingItem = {
  label: string;   // e.g. "Authentication method"
  detail: string;  // e.g. "Found: Bearer token in Authorization header, documented at /docs/api/auth.md"
}
```

---

## The agent

### Model and tool

```ts
model: "claude-sonnet-4-6"
tools: [{
  type: "web_search_20260209",
  name: "web_search",
  max_uses: 25
}]
stream: true
```

### Starting context

Cold start. Claude is given only:
- The domain
- The task prompt
- The system prompt below

No docs are pre-loaded. No llms.txt is fetched in advance. Claude decides for itself where to go first — exactly as a real coding agent would.

### System prompt

```
You are a developer trying to accomplish a specific task using a product's documentation.
You have never used this product before. You are starting from scratch.

Your job is to:
1. Navigate the product's documentation site to find everything you need
2. Extract the exact information required to complete the task
3. Write working code that accomplishes the task

As you work, think out loud at every step. Before each search or fetch, explain what
you're looking for and why. After reading a page, summarize exactly what you found and
what you still need.

At the end, produce:
- The complete code to accomplish the task, fenced with the appropriate language identifier
- A JSON findings block (delimited by <findings>...</findings>) structured as follows:
  {
    "task_understood": true,
    "context_found": [
      { "label": "what you needed", "detail": "what you found and where" }
    ],
    "context_missing": [
      { "label": "what you needed", "detail": "what was missing or unclear" }
    ],
    "confidence": "high" | "medium" | "low",
    "recommendation": "One paragraph addressed to the site owner explaining what would
                       have made this task easier for an AI agent to complete."
  }

Be honest. If you had to guess at something because the docs were unclear, say so.
If you couldn't find something and fell back on general knowledge, say so explicitly.
Do not hallucinate API endpoints, parameters, or authentication methods.
```

### Parsing the streaming response

The Anthropic streaming API returns `content_block` events. You iterate through them in order and build the trace array in real time:

```ts
// Pseudocode for parsing the stream
for await (const event of stream) {
  if (event.type === "content_block_start") {
    if (event.content_block.type === "text") {
      // Claude is thinking — buffer text until content_block_stop
      currentThinking = ""
    }
    if (event.content_block.type === "tool_use") {
      // Claude is about to make a web search
      currentToolCall = { name: event.content_block.name, input: {} }
    }
  }

  if (event.type === "content_block_delta") {
    if (event.delta.type === "text_delta") {
      currentThinking += event.delta.text
      // Emit SSE: partial thinking text (for live typewriter effect)
    }
    if (event.delta.type === "input_json_delta") {
      // Accumulate tool input (the search query being formed)
    }
  }

  if (event.type === "content_block_stop") {
    if (currentThinking) {
      // Flush thinking block to trace + emit SSE
      trace.push({ type: "thinking", text: currentThinking, timestamp: now() })
      emit("step", { type: "thinking", text: currentThinking })
      currentThinking = ""
    }
    if (currentToolCall) {
      // Tool call is complete — emit fetch step
      trace.push({ type: "fetch", url: currentToolCall.input.query, timestamp: now() })
      emit("step", { type: "fetch", url: currentToolCall.input.query })
      currentToolCall = null
    }
  }
}
```

After the stream completes, parse the final text output to extract:
- The fenced code block → `sessions.code_output`
- The `<findings>...</findings>` JSON block → `sessions.findings`
- Update `sessions.status` to `complete` and set `completed_at`

---

## API routes

### `POST /api/sessions`

Creates a new session and begins streaming the agent run.

**Request body:**
```json
{
  "domain": "resend.com",
  "task": "Send a transactional email with an attachment to a verified domain"
}
```

**Behavior:**
1. Normalize domain (strip protocol, www, trailing slash)
2. Insert a new row into `sessions` with `status: 'running'`
3. Return the session ID immediately in headers: `X-Session-Id: <uuid>`
4. Begin streaming SSE events as the agent runs
5. On completion, update the session row with trace, code output, findings, status

**Response:** SSE stream

**SSE event types:**

```
event: step
data: { "type": "thinking", "text": "I'll start by checking if resend.com has an llms.txt..." }

event: step
data: { "type": "fetch", "url": "https://resend.com/llms.txt", "status": 200 }

event: step
data: { "type": "extract", "url": "https://resend.com/llms.txt", "found": ["Full docs index at /docs/llms.txt", "SDK links for 9 languages"], "missing": [] }

event: step
data: { "type": "thinking", "text": "Good. The llms.txt points to a full index. I'll follow that to find the email sending docs..." }

event: complete
data: { "sessionId": "uuid-here" }

event: error
data: { "message": "Agent timed out. Please retry." }
```

**Vercel function config:**
```ts
export const maxDuration = 120;
export const dynamic = "force-dynamic";
```

### `GET /api/sessions/[id]`

Returns the full session record. Used by the replay page to load a saved session.

**Response:**
```json
{
  "id": "uuid",
  "domain": "resend.com",
  "task": "Send a transactional email...",
  "status": "complete",
  "trace": [...],
  "code_output": "```typescript\n...\n```",
  "findings": { ... },
  "is_public": false,
  "created_at": "...",
  "completed_at": "..."
}
```

### `PATCH /api/sessions/[id]`

Toggles `is_public` on a session.

**Request body:**
```json
{ "is_public": true }
```

No auth in MVP — anyone with the session ID can toggle it. Add auth in v2.

---

## Pages

### `/` — Home

A minimal entry point. Two inputs:
- Domain field (e.g. `resend.com`)
- Task prompt (free text, multi-line, placeholder examples shown)

A "Run" button. No login required.

**Suggested placeholder prompts shown as chips below the task input:**
- "Send a transactional email with an attachment"
- "Authenticate with the API using a Bearer token"
- "Set up a webhook to receive events"
- "Handle rate limiting and retry failed requests"
- "List all resources and paginate through results"

These are illustrative — the user can type anything.

When the user hits Run, they are immediately redirected to `/sessions/[id]` where the live stream begins.

### `/sessions/[id]` — Live session + replay

This page serves double duty: it streams live during the run, and shows the saved replay afterward. The UI is the same either way — the difference is whether data is arriving via SSE or loaded from the database.

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  resend.com                              [Share] [Copy]  │
│  "Send a transactional email with an attachment"         │
│  Completed · 47 seconds · 8 fetches                     │
├──────────────────────┬──────────────────────────────────┤
│                      │                                  │
│   AGENT TRACE        │   CODE OUTPUT                    │
│                      │                                  │
│  💭 Thinking...      │   ```typescript                  │
│  🔍 Fetching...      │   import { Resend } from ...     │
│  📄 Extracting...    │   ...                            │
│  💭 Thinking...      │   ```                            │
│  🔍 Fetching...      │                                  │
│  ...                 ├──────────────────────────────────┤
│                      │   FINDINGS                       │
│                      │                                  │
│                      │   ✓ Found: API authentication    │
│                      │   ✓ Found: Send email endpoint   │
│                      │   ✗ Missing: Attachment limits   │
│                      │   ✗ Missing: Error code docs     │
│                      │                                  │
│                      │   Confidence: Medium             │
│                      │                                  │
│                      │   Recommendation: ...            │
└──────────────────────┴──────────────────────────────────┘
```

**Left panel — Agent trace:**

Each step renders as a card in a vertical timeline. Steps appear sequentially, animated in as they arrive (live) or staggered on load (replay).

- `thinking` steps: plain text, slightly muted, typewriter effect during live stream
- `fetch` steps: URL + HTTP status badge (200 green, 404 red, etc.)
- `extract` steps: two columns — found (green checkmarks) and missing (red crosses)
- `conclusion` steps: highlighted card, bold text

**Right panel — two tabs:**

Tab 1: Code output — syntax-highlighted code block. If multiple code blocks were produced, show all of them in order.

Tab 2: Findings — structured breakdown of what the agent found and what was missing, plus the agent's confidence rating and recommendation paragraph addressed to the site owner.

**Share behavior:**

A "Share" button in the header. When clicked:
- If `is_public: false` — shows a modal: "Make this session public? Anyone with the link will be able to view it." Confirm → calls `PATCH /api/sessions/[id]` → button changes to "Copy link"
- If `is_public: true` — immediately copies the URL to clipboard

If `is_public: false` and someone navigates to the URL directly, show a 404-style page: "This session is private."

---

## Error handling

### Agent timeout (120s hit)
- Emit `event: error` on the SSE stream
- Save whatever trace was collected so far with `status: 'failed'`
- Show in UI: "The agent ran out of time. The partial trace is saved below. Try a more specific task."

### Domain unreachable
- If Claude's first fetch attempts all 404 or timeout, Claude will surface this in its reasoning
- It shows up naturally in the trace as a `fetch` step with a non-200 status
- No special handling needed — the trace tells the story

### Malformed findings JSON
- Wrap `JSON.parse(findingsBlock)` in try/catch
- If it fails, store `findings: null` and show "Agent did not produce a structured findings report" in the UI
- The trace and code output are still shown normally

### Claude refuses the task
- Extremely unlikely for documentation tasks, but if it happens, emit `event: error`
- Show: "The agent was unable to attempt this task. Please rephrase your prompt."

---

## Project structure

```
capra/
├── app/
│   ├── page.tsx                      # Home — domain + task input
│   ├── sessions/
│   │   └── [id]/
│   │       └── page.tsx              # Live session + replay
│   └── api/
│       ├── sessions/
│       │   ├── route.ts              # POST — create session, stream SSE
│       │   └── [id]/
│       │       └── route.ts          # GET — fetch session, PATCH — toggle public
├── lib/
│   ├── agent/
│   │   ├── run.ts                    # Core agent execution + stream parsing
│   │   ├── prompts.ts                # System prompt + user prompt builder
│   │   └── types.ts                  # TraceStep, Findings, Session types
│   └── db/
│       ├── schema.ts                 # Drizzle schema
│       └── index.ts                  # Neon client + Drizzle instance
├── components/
│   ├── TaskInput.tsx                 # Home page form
│   ├── SessionView.tsx               # Orchestrates live + replay view
│   ├── AgentTrace.tsx                # Left panel — trace timeline
│   ├── TraceStep.tsx                 # Individual step card
│   ├── CodeOutput.tsx                # Syntax-highlighted code panel
│   ├── FindingsPanel.tsx             # Findings breakdown panel
│   └── ShareButton.tsx               # Share / copy link button
├── drizzle.config.ts
└── .env.local
```

---

## Key implementation notes

### 1. Return the session ID before the stream starts
The session must be created in the database before SSE begins, so the client has an ID to poll or reload if the connection drops. Insert the row, get the UUID, set `X-Session-Id` response header, then open the stream.

### 2. Write trace steps to the database incrementally
Don't wait until the agent finishes to save the trace. After each step is parsed from the stream, append it to the `trace` JSONB array in Postgres. This means if the connection drops mid-session, the partial trace is recoverable.

```ts
// After each step
await db.execute(sql`
  UPDATE sessions
  SET trace = trace || ${JSON.stringify([step])}::jsonb
  WHERE id = ${sessionId}
`)
```

### 3. The live view and replay view are the same component
`SessionView.tsx` accepts a `sessionId`. On mount, it checks if the session status is `running` — if so, it opens an SSE connection to `/api/sessions` and appends steps as they arrive. If status is `complete` or `failed`, it loads the saved trace from `GET /api/sessions/[id]` and renders it statically (with a staggered animation to feel like a replay).

### 4. Thinking text should stream word by word during live view
Use `content_block_delta` events with `text_delta` to stream Claude's thinking text character by character. Emit a `step:partial` SSE event type for in-progress thinking, and a `step` event when the block is complete. The UI renders the partial text with a blinking cursor.

### 5. Parse code output carefully
Claude will produce one or more fenced code blocks in its final response. Extract them all with a regex:
```ts
const codeBlocks = [...output.matchAll(/```(\w+)?\n([\s\S]*?)```/g)]
  .map(m => ({ language: m[1] || "text", code: m[2].trim() }))
```
Store the array in `code_output` as JSON, not raw text.

### 6. The task prompt is freeform — guide without constraining
The system prompt instructs Claude to produce a findings block, but the task itself is whatever the user typed. Don't validate or restrict it. If someone types "explain how pricing works" instead of a coding task, Claude will do that — the trace and findings will reflect it. That's fine and often useful.

### 7. Domain normalization
```ts
function normalizeDomain(input: string): string {
  return input
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .toLowerCase()
    .trim()
}
// "https://www.Resend.com/docs" → "resend.com"
```

### 8. `max_uses: 25` on web search
This caps the agent at 25 web fetches per session. Enough for a thorough task, not enough to run away on cost. A typical session uses 6–15 fetches.

---

## What success looks like for MVP

- Enter `resend.com` + "Send a transactional email with an attachment"
- Watch Claude navigate to `llms.txt`, follow to the docs index, find the send email endpoint, read the attachments section, and write correct TypeScript
- The trace shows every step
- The findings show: authentication method found, send endpoint found, attachment size limits not documented
- The recommendation tells Resend exactly what to add to their docs
- The session is saved and replayable at a permanent URL
- A "Share" button makes it public and copyable

That one session, for one real company, with a real task, producing a real finding — that is the demo.
