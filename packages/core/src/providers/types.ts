/** Papel de uma mensagem numa conversa. */
export type Role = "system" | "user" | "assistant" | "tool";

/** Um pedido do modelo para executar uma ferramenta. */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface Message {
  role: Role;
  content: string;
  /** Presente em mensagens 'assistant' que pediram execução de ferramentas. */
  toolCalls?: ToolCall[];
  /** Presente em mensagens 'tool' (resultado); referencia o `ToolCall.id`. */
  toolCallId?: string;
  /** Nome opcional (ex.: nome da ferramenta em mensagens 'tool'). */
  name?: string;
}

/** Descrição de uma ferramenta enviada ao modelo (JSON Schema dos parâmetros). */
export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatOptions {
  model: string;
  messages: Message[];
  /** Ferramentas disponíveis nesta chamada (function-calling). */
  tools?: ToolSchema[];
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

export type FinishReason = "stop" | "tool_calls" | "length" | "unknown";

export interface ChatResult {
  content: string;
  model: string;
  /** Ferramentas que o modelo pediu para executar, se houver. */
  toolCalls?: ToolCall[];
  finishReason: FinishReason;
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
