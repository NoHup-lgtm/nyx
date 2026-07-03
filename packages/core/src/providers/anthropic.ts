import {
  type ChatChunk,
  type ChatOptions,
  type ChatResult,
  type FinishReason,
  type Message,
  type Provider,
  ProviderError,
  type ToolCall,
} from "./types.js";
import { parseSSE } from "./sse.js";

export interface AnthropicConfig {
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  version?: string;
}

const DEFAULT_MAX_TOKENS = 4096;

/** Extrai o system prompt e converte o resto para o formato de blocos da Anthropic. */
function toAnthropic(messages: Message[]): { system?: string; msgs: any[] } {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const msgs: any[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;

    if (m.role === "tool") {
      // Resultados de tools são blocos num turno 'user'. Vários resultados
      // seguidos são agrupados no mesmo turno (a API exige isso).
      const block = { type: "tool_result", tool_use_id: m.toolCallId, content: m.content };
      const last = msgs[msgs.length - 1];
      if (last?.role === "user" && Array.isArray(last.content) && last._toolTurn) {
        last.content.push(block);
      } else {
        msgs.push({ role: "user", content: [block], _toolTurn: true });
      }
      continue;
    }

    if (m.role === "assistant" && m.toolCalls?.length) {
      const content: any[] = [];
      if (m.content) content.push({ type: "text", text: m.content });
      for (const tc of m.toolCalls) {
        content.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.arguments });
      }
      msgs.push({ role: "assistant", content });
      continue;
    }

    msgs.push({ role: m.role, content: m.content });
  }

  // Remove o marcador interno antes de enviar.
  for (const msg of msgs) delete msg._toolTurn;
  return { system: system || undefined, msgs };
}

function mapStopReason(reason: string | undefined): FinishReason {
  switch (reason) {
    case "end_turn":
    case "stop_sequence":
      return "stop";
    case "tool_use":
      return "tool_calls";
    case "max_tokens":
      return "length";
    default:
      return "unknown";
  }
}

/** Adapter para a Messages API da Anthropic (formato próprio, não OpenAI). */
export class AnthropicProvider implements Provider {
  readonly id: string;
  readonly label: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly version: string;

  constructor(cfg: AnthropicConfig) {
    this.id = cfg.id;
    this.label = cfg.label;
    this.baseUrl = cfg.baseUrl.replace(/\/$/, "");
    this.apiKey = cfg.apiKey;
    this.version = cfg.version ?? "2023-06-01";
  }

  private async post(opts: ChatOptions, stream: boolean): Promise<Response> {
    const { system, msgs } = toAnthropic(opts.messages);
    const body: Record<string, unknown> = {
      model: opts.model,
      system,
      messages: msgs,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
      stream,
    };
    if (opts.tools?.length) {
      body.tools = opts.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      signal: opts.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": this.version,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new ProviderError(
        `${this.label} respondeu ${res.status}: ${detail.slice(0, 500)}`,
        this.id,
        res.status,
      );
    }
    return res;
  }

  async chat(opts: ChatOptions): Promise<ChatResult> {
    const res = await this.post(opts, false);
    const json = (await res.json()) as any;

    let content = "";
    const toolCalls: ToolCall[] = [];
    if (Array.isArray(json.content)) {
      for (const block of json.content) {
        if (block.type === "text") content += block.text;
        else if (block.type === "tool_use") {
          toolCalls.push({ id: block.id, name: block.name, arguments: block.input ?? {} });
        }
      }
    }

    return {
      content,
      model: json.model ?? opts.model,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      finishReason: mapStopReason(json.stop_reason),
      usage: json.usage
        ? {
            promptTokens: json.usage.input_tokens,
            completionTokens: json.usage.output_tokens,
            totalTokens:
              (json.usage.input_tokens ?? 0) + (json.usage.output_tokens ?? 0),
          }
        : undefined,
    };
  }

  async *stream(opts: ChatOptions): AsyncIterable<ChatChunk> {
    const res = await this.post(opts, true);
    for await (const data of parseSSE(res.body)) {
      let event: any;
      try {
        event = JSON.parse(data);
      } catch {
        continue;
      }
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        yield { delta: event.delta.text ?? "", done: false };
      }
    }
    yield { delta: "", done: true };
  }

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/v1/models`, {
      headers: { "x-api-key": this.apiKey, "anthropic-version": this.version },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new ProviderError(
        `${this.label} respondeu ${res.status}: ${detail.slice(0, 300)}`,
        this.id,
        res.status,
      );
    }
    const json = (await res.json()) as any;
    const ids: string[] = (json.data ?? []).map((m: any) => m.id).filter(Boolean);
    return ids.sort((a, b) => a.localeCompare(b));
  }
}
