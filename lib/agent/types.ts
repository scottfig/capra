export type ThinkingStep = {
  type: "thinking";
  text: string;
  sources?: string[];
  timestamp: string;
};

export type FetchStep = {
  type: "fetch";
  url: string;
  status: number;
  timestamp: string;
};

export type SourcesStep = {
  type: "sources";
  urls: string[];
  timestamp: string;
};

export type TraceStep = ThinkingStep | FetchStep | SourcesStep;

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

export type SourceRange = {
  start: number; // 1-based, inclusive
  end: number; // 1-based, inclusive
  sourceUrl: string;
  excerpt?: string; // verbatim snippet from the source page
};

export type ArtifactKind = "code" | "command";

export type CodeBlock = {
  kind: ArtifactKind;
  language: string;
  code: string;
  sourceRanges: SourceRange[];
};

export type SSEStepEvent =
  | { eventType: "step"; step: TraceStep }
  | { eventType: "step:partial"; text: string }
  | { eventType: "complete"; sessionId: string }
  | { eventType: "error"; message: string };
