import {
  type ChatChunk,
  type ChatOptions,
  type ChatResult,
  type Message,
  type Provider,
  ProviderError,
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

  /** Anthropic separa o system prompt do array de mensagens. */
  private split(messages: Message[]): { system?: string; msgs: { role: string; content: string }[] } {
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const msgs = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));
    return { system: system || undefined, msgs };
  }

  private async post(opts: ChatOptions, stream: boolean): Promise<Response> {
    const { system, msgs } = this.split(opts.messages);
    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      signal: opts.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": this.version,
      },
      body: JSON.stringify({
        model: opts.model,
        system,
        messages: msgs,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
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
    const content = Array.isArray(json.content)
      ? json.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("")
      : "";
    return {
      content,
      model: json.model ?? opts.model,
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
}
