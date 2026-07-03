import type { Message, Provider, ToolCall } from "../providers/types.js";
import type { Tool } from "../tools/types.js";
import { toToolSchema } from "../tools/types.js";
import type { PermissionManager } from "../tools/permissions.js";
import type { ScopeGuard } from "../tools/scope.js";

export interface RunHooks {
  /** Texto que o modelo produziu num passo (antes de chamar tools ou no final). */
  onText?(text: string): void;
  /** O modelo pediu para executar uma tool. */
  onToolCall?(call: ToolCall): void;
  /** Resultado de uma tool executada (ou negada). */
  onToolResult?(call: ToolCall, result: string, status: "ok" | "denied" | "error"): void;
  /** Início de cada passo do loop (1-indexado). */
  onStep?(step: number, maxSteps: number): void;
}

export interface RunOptions {
  provider: Provider;
  model: string;
  tools: Tool[];
  permissions: PermissionManager;
  /** Restringe as tools a alvos autorizados (opcional). */
  scope?: ScopeGuard;
  cwd: string;
  systemPrompt?: string;
  temperature?: number;
  maxSteps?: number;
  signal?: AbortSignal;
  hooks?: RunHooks;
}

export interface RunResult {
  /** Resposta final em texto. */
  answer: string;
  steps: number;
  /** True se parou por atingir o limite de passos. */
  hitLimit: boolean;
  messages: Message[];
}

/**
 * Loop agêntico: envia a tarefa ao modelo com as tools disponíveis, executa as
 * tools que ele pedir (respeitando as permissões) e repete até o modelo dar uma
 * resposta final ou atingir `maxSteps`.
 */
export async function runTask(task: string, opts: RunOptions): Promise<RunResult> {
  const maxSteps = opts.maxSteps ?? 25;
  const toolsByName = new Map(opts.tools.map((t) => [t.name, t]));
  const schemas = opts.tools.map(toToolSchema);

  const messages: Message[] = [];
  if (opts.systemPrompt) messages.push({ role: "system", content: opts.systemPrompt });
  messages.push({ role: "user", content: task });

  for (let step = 1; step <= maxSteps; step++) {
    opts.hooks?.onStep?.(step, maxSteps);

    const result = await opts.provider.chat({
      model: opts.model,
      messages,
      tools: schemas,
      temperature: opts.temperature,
      signal: opts.signal,
    });

    if (result.content) opts.hooks?.onText?.(result.content);

    // Sem tools pedidas → resposta final.
    if (!result.toolCalls?.length) {
      messages.push({ role: "assistant", content: result.content });
      return { answer: result.content, steps: step, hitLimit: false, messages };
    }

    // Registra o turno do assistant (texto + pedidos de tool).
    messages.push({
      role: "assistant",
      content: result.content,
      toolCalls: result.toolCalls,
    });

    // Executa cada tool pedida.
    for (const call of result.toolCalls) {
      opts.hooks?.onToolCall?.(call);
      const tool = toolsByName.get(call.name);

      if (!tool) {
        const msg = `Ferramenta desconhecida: ${call.name}`;
        opts.hooks?.onToolResult?.(call, msg, "error");
        messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: msg });
        continue;
      }

      // Escopo primeiro: um alvo fora do escopo é bloqueado antes de qualquer permissão.
      if (opts.scope?.active) {
        const verdict = opts.scope.check(call.name, call.arguments);
        if (!verdict.allowed) {
          const msg = `BLOQUEADO (fora do escopo): ${verdict.detail}`;
          opts.hooks?.onToolResult?.(call, msg, "denied");
          messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: msg });
          continue;
        }
      }

      const allowed = await opts.permissions.authorize({ tool, input: call.arguments });
      if (!allowed) {
        const msg = "Execução negada pela política de permissões / usuário.";
        opts.hooks?.onToolResult?.(call, msg, "denied");
        messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: msg });
        continue;
      }

      try {
        const output = await tool.execute(call.arguments, {
          cwd: opts.cwd,
          signal: opts.signal,
        });
        opts.hooks?.onToolResult?.(call, output, "ok");
        messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: output });
      } catch (err) {
        const msg = `Erro ao executar ${call.name}: ${(err as Error).message}`;
        opts.hooks?.onToolResult?.(call, msg, "error");
        messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: msg });
      }
    }
  }

  const last = [...messages].reverse().find((m) => m.role === "assistant");
  return { answer: last?.content ?? "", steps: maxSteps, hitLimit: true, messages };
}
