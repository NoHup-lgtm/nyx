import {
  type ChatChunk,
  type ChatOptions,
  type ChatResult,
  type Provider,
  ProviderError,
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
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      signal: opts.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...this.extraHeaders,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages.map((m) => ({ role: m.role, content: m.content, name: m.name })),
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        stream,
      }),
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
    return {
      content: json.choices?.[0]?.message?.content ?? "",
      model: json.model ?? opts.model,
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
}
