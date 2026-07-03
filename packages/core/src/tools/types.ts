import type { ToolSchema } from "../providers/types.js";

export interface ToolContext {
  /** Diretório de trabalho para tools de shell/filesystem. */
  cwd: string;
  signal?: AbortSignal;
}

/**
 * Uma ferramenta que o agente pode invocar. `parameters` é um JSON Schema do
 * objeto de entrada; `execute` recebe o input já parseado e devolve texto.
 */
export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** Rótulo de risco — usado pelos padrões de permissão. */
  risk: "read" | "write" | "exec" | "network";
  execute(input: Record<string, unknown>, ctx: ToolContext): Promise<string>;
}

export function toToolSchema(tool: Tool): ToolSchema {
  return { name: tool.name, description: tool.description, parameters: tool.parameters };
}

/** Trunca saídas grandes para não estourar o contexto do modelo. */
export function truncate(text: string, max = 12_000): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n\n…[saída truncada, ${text.length - max} chars omitidos]`;
}
