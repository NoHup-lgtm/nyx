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

export interface OpenAICompatibleConfig {
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  /** Cabeçalhos extras (ex.: OpenRouter recomenda HTTP-Referer / X-Title). */
  headers?: Record<string, string>;
}

/** Converte nossas mensagens normalizadas para o formato da OpenAI. */
function toOpenAIMessages(messages: Message[]): unknown[] {
  return messages.map((m) => {
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      };
    }
    if (m.role === "tool") {
      return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
    }
    return { role: m.role, content: m.content, name: m.name };
  });
}

function mapFinishReason(reason: string | undefined): FinishReason {
  switch (reason) {
    case "stop":
      return "stop";
    case "tool_calls":
    case "function_call":
      return "tool_calls";
    case "length":
      return "length";
    default:
      return "unknown";
  }
}

/**
 * Adapter para qualquer API compatível com o formato Chat Completions da OpenAI.
 * Cobre OpenAI, OpenRouter, NVIDIA NIM, Groq, Together, Ollama, etc. — só muda a
 * baseUrl e a chave.
 */
export class OpenAICompatibleProvider implements Provider {
  readonly id: string;
  readonly label: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly extraHeaders: Record<string, string>;

  constructor(cfg: OpenAICompatibleConfig) {
    this.id = cfg.id;
    this.label = cfg.label;
    this.baseUrl = cfg.baseUrl.replace(/\/$/, "");
    this.apiKey = cfg.apiKey;
    this.extraHeaders = cfg.headers ?? {};
  }

  private async post(opts: ChatOptions, stream: boolean): Promise<Response> {
    const body: Record<string, unknown> = {
      model: opts.model,
      messages: toOpenAIMessages(opts.messages),
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
      stream,
    };
    if (opts.tools?.length) {
      body.tools = opts.tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      signal: opts.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...this.extraHeaders,
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
    const choice = json.choices?.[0];
    const rawCalls = choice?.message?.tool_calls;

    let toolCalls: ToolCall[] | undefined;
    if (Array.isArray(rawCalls) && rawCalls.length) {
      toolCalls = rawCalls.map((tc: any) => ({
        id: tc.id,
        name: tc.function?.name ?? "",
        arguments: safeParseArgs(tc.function?.arguments),
      }));
    }

    return {
      content: choice?.message?.content ?? "",
      model: json.model ?? opts.model,
      toolCalls,
      finishReason: mapFinishReason(choice?.finish_reason),
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens,
            completionTokens: json.usage.completion_tokens,
            totalTokens: json.usage.total_tokens,
          }
        : undefined,
    };
  }

  async *stream(opts: ChatOptions): AsyncIterable<ChatChunk> {
    const res = await this.post(opts, true);
    for await (const data of parseSSE(res.body)) {
      let parsed: any;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      const delta = parsed.choices?.[0]?.delta?.content ?? "";
      if (delta) yield { delta, done: false };
    }
    yield { delta: "", done: true };
  }

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${this.apiKey}`, ...this.extraHeaders },
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

function safeParseArgs(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string") return (raw as Record<string, unknown>) ?? {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
