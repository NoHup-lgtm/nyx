import type { ToolCall } from "../providers/types.js";

export type EventType = "task" | "assistant" | "tool_call" | "tool_result";
export type ToolStatus = "ok" | "denied" | "error";

export interface RecordedEvent {
  /** ISO timestamp. */
  at: string;
  type: EventType;
  /** task / assistant. */
  text?: string;
  /** tool_call / tool_result. */
  id?: string;
  tool?: string;
  /** tool_call. */
  args?: Record<string, unknown>;
  /** tool_result. */
  status?: ToolStatus;
  output?: string;
}

export interface RecordedSession {
  id: string;
  createdAt: string;
  provider: string;
  model: string;
  cwd: string;
  /** Escopo autorizado (hosts/domínios). Vazio = sem restrição. */
  scope: string[];
  task: string;
  events: RecordedEvent[];
}

function genId(): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  const rand = Math.random().toString(36).slice(2, 6);
  return `sess-${stamp}-${rand}`;
}

/**
 * "Flight recorder": acumula os eventos de uma execução autônoma para depois
 * virar relatório/PoC com evidência real.
 */
export class Recorder {
  readonly session: RecordedSession;

  constructor(init: { provider: string; model: string; cwd: string; scope?: string[]; task?: string }) {
    this.session = {
      id: genId(),
      createdAt: new Date().toISOString(),
      provider: init.provider,
      model: init.model,
      cwd: init.cwd,
      scope: init.scope ?? [],
      task: init.task ?? "",
      events: [],
    };
  }

  private push(e: Omit<RecordedEvent, "at">): void {
    this.session.events.push({ at: new Date().toISOString(), ...e });
  }

  task(text: string): void {
    this.session.task = text;
    this.push({ type: "task", text });
  }

  assistant(text: string): void {
    if (text.trim()) this.push({ type: "assistant", text });
  }

  toolCall(call: ToolCall): void {
    this.push({ type: "tool_call", id: call.id, tool: call.name, args: call.arguments });
  }

  toolResult(call: ToolCall, output: string, status: ToolStatus): void {
    this.push({ type: "tool_result", id: call.id, tool: call.name, output, status });
  }
}
