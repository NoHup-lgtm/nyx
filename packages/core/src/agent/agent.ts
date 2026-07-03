import type { ChatChunk, Message, Provider } from "../providers/types.js";

export interface AgentOptions {
  provider: Provider;
  model: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Agente de conversa mínimo: mantém histórico e fala com um Provider.
 * É o ponto de extensão para tools, memória e autonomia (roadmap).
 */
export class Agent {
  private readonly history: Message[] = [];
  private readonly opts: AgentOptions;

  constructor(opts: AgentOptions) {
    this.opts = opts;
    if (opts.systemPrompt) {
      this.history.push({ role: "system", content: opts.systemPrompt });
    }
  }

  get messages(): readonly Message[] {
    return this.history;
  }

  reset(): void {
    this.history.length = 0;
    if (this.opts.systemPrompt) {
      this.history.push({ role: "system", content: this.opts.systemPrompt });
    }
  }

  /** Cópia do histórico atual (para transferir entre agentes). */
  snapshot(): Message[] {
    return [...this.history];
  }

  /** Substitui o histórico (ex.: ao trocar de modelo/provider mantendo a conversa). */
  restore(messages: Message[]): void {
    this.history.length = 0;
    this.history.push(...messages);
  }

  /** Envia uma mensagem do usuário e retorna a resposta completa. */
  async send(input: string, signal?: AbortSignal): Promise<string> {
    this.history.push({ role: "user", content: input });
    const result = await this.opts.provider.chat({
      model: this.opts.model,
      messages: [...this.history],
      temperature: this.opts.temperature,
      maxTokens: this.opts.maxTokens,
      signal,
    });
    this.history.push({ role: "assistant", content: result.content });
    return result.content;
  }

  /** Igual a `send`, mas em streaming. Acumula a resposta no histórico ao final. */
  async *sendStream(input: string, signal?: AbortSignal): AsyncGenerator<ChatChunk> {
    this.history.push({ role: "user", content: input });
    let full = "";
    for await (const chunk of this.opts.provider.stream({
      model: this.opts.model,
      messages: [...this.history],
      temperature: this.opts.temperature,
      maxTokens: this.opts.maxTokens,
      signal,
    })) {
      full += chunk.delta;
      yield chunk;
    }
    this.history.push({ role: "assistant", content: full });
  }
}
