export type ThinkingStep = {
  type: "thinking";
  text: string;
  timestamp: string;
};

export type FetchStep = {
  type: "fetch";
  url: string;
  status: number;
  timestamp: string;
};

export type ExtractStep = {
  type: "extract";
  url: string;
  found: string[];
  missing: string[];
  timestamp: string;
};

export type ConclusionStep = {
  type: "conclusion";
  text: string;
  timestamp: string;
};

export type TraceStep = ThinkingStep | FetchStep | ExtractStep | ConclusionStep;

export type FindingItem = {
  label: string;
  detail: string;
};

export type Findings = {
  task_understood: boolean;
  context_found: FindingItem[];
  context_missing: FindingItem[];
  confidence: "high" | "medium" | "low";
  recommendation: string;
};

export type CodeBlock = {
  language: string;
  code: string;
};

export type SSEStepEvent =
  | { eventType: "step"; step: TraceStep }
  | { eventType: "step:partial"; text: string }
  | { eventType: "complete"; sessionId: string }
  | { eventType: "error"; message: string };
