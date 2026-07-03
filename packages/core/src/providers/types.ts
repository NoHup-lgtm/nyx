/** Papel de uma mensagem numa conversa. */
export type Role = "system" | "user" | "assistant" | "tool";

export interface Message {
  role: Role;
  content: string;
  /** Nome opcional (ex.: nome da ferramenta em mensagens `tool`). */
  name?: string;
}

export interface ChatOptions {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  /** Aborta a requisição (ex.: Ctrl+C no CLI). */
  signal?: AbortSignal;
}

export interface Usage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ChatResult {
  content: string;
  model: string;
  usage?: Usage;
}

/** Um pedaço do stream de resposta. */
export interface ChatChunk {
  /** Texto incremental desta parte. */
  delta: string;
  done: boolean;
}

/**
 * Contrato único que todo provider implementa. É isto que torna o Nyx
 * agnóstico: o resto do sistema só conhece esta interface.
 */
export interface Provider {
  readonly id: string;
  readonly label: string;
  chat(opts: ChatOptions): Promise<ChatResult>;
  stream(opts: ChatOptions): AsyncIterable<ChatChunk>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly providerId: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
