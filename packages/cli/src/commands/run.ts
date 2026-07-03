import { createInterface, type Interface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  BUILTIN_TOOLS,
  PermissionManager,
  ProviderError,
  Recorder,
  ScopeGuard,
  createProvider,
  loadConfig,
  keyFromConfig,
  resolvePolicy,
  resolveModel,
  runTask,
  saveSession,
  type Confirmer,
  type Decision,
  type PermissionPolicy,
  type Provider,
  type RunHooks,
} from "@nyx/core";
import { banner, c } from "../banner.js";

/** Divide uma lista separada por vírgula em itens limpos. */
function splitList(v: string | undefined): string[] {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export interface RunFlags {
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  maxSteps?: string;
  temperature?: string;
  cwd?: string;
  yes?: boolean;
  allow?: string;
  deny?: string;
  /** Escopo autorizado (hosts separados por vírgula). */
  scope?: string;
  /** Commander seta `record: false` quando passam --no-record. Padrão: grava. */
  record?: boolean;
}

export const SYSTEM_PROMPT =
  "Você é Nyx, um agente autônomo que resolve tarefas usando as ferramentas disponíveis. " +
  "Planeje, use tools quando precisar (shell, arquivos, rede) e só responda em texto quando " +
  "a tarefa estiver concluída. Seja direto e técnico.";

export function preview(obj: Record<string, unknown>): string {
  const s = JSON.stringify(obj);
  return s.length > 120 ? s.slice(0, 117) + "…" : s;
}

/** Aplica flags --allow/--deny por cima da policy do config. */
export function policyFromFlags(base: Partial<PermissionPolicy>, flags: RunFlags): PermissionPolicy {
  const policy = resolvePolicy(base);
  const apply = (list: string | undefined, decision: Decision) => {
    for (const name of (list ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
      if (name === "all") policy.default = decision;
      else policy.tools[name] = decision;
    }
  };
  apply(flags.allow, "allow");
  apply(flags.deny, "deny");
  return policy;
}

/** Confirmer que pergunta no terminal (reutiliza um readline já aberto). */
export function makeConfirmer(rl: Interface): Confirmer {
  return async ({ tool, input }) => {
    const ans = (
      await rl.question(
        c.cyan(`\n  ⚠ permitir `) +
          c.bold(tool.name) +
          c.cyan(`(${preview(input)})? `) +
          c.dim("[y/N] "),
      )
    )
      .trim()
      .toLowerCase();
    return ans === "y" || ans === "yes" || ans === "s" || ans === "sim";
  };
}

/** Com --yes/sem confirmer, "ask" vira "allow" (mantém "deny"). */
export function buildPermissions(
  policy: PermissionPolicy,
  opts: { yes?: boolean; rl?: Interface },
): PermissionManager {
  if (opts.yes) {
    const relaxed: PermissionPolicy = {
      default: policy.default === "ask" ? "allow" : policy.default,
      tools: Object.fromEntries(
        Object.entries(policy.tools).map(([k, v]) => [k, v === "ask" ? "allow" : v]),
      ),
    };
    return new PermissionManager(relaxed);
  }
  return new PermissionManager(policy, opts.rl ? makeConfirmer(opts.rl) : undefined);
}

/** Hooks que renderizam o progresso e (se houver) alimentam o gravador. */
function makeHooks(recorder?: Recorder): RunHooks {
  return {
    onStep: (step, max) => console.log(c.dim(`— passo ${step}/${max} —`)),
    onText: (text) => {
      if (!text.trim()) return;
      console.log(c.cyan("nyx › ") + text.trim());
      recorder?.assistant(text);
    },
    onToolCall: (call) => {
      console.log(c.violet("  🔧 ") + c.bold(call.name) + c.dim(` ${preview(call.arguments)}`));
      recorder?.toolCall(call);
    },
    onToolResult: (call, output, status) => {
      const icon =
        status === "ok" ? c.green("  ✓") : status === "denied" ? c.red("  ⨯") : c.red("  ！");
      const head = output.split("\n").slice(0, 6).join("\n");
      console.log(icon + c.dim(" " + head.replace(/\n/g, "\n     ")));
      recorder?.toolResult(call, output, status);
    },
  };
}

/** Executa uma tarefa autônoma e renderiza o progresso. Reutilizável (CLI e REPL). */
export async function runAgentTask(
  task: string,
  opts: {
    provider: Provider;
    model: string;
    cwd: string;
    permissions: PermissionManager;
    scope?: ScopeGuard;
    recorder?: Recorder;
    temperature?: number;
    maxSteps?: number;
  },
): Promise<{ sessionId?: string; sessionPath?: string }> {
  opts.recorder?.task(task);

  const result = await runTask(task, {
    provider: opts.provider,
    model: opts.model,
    tools: BUILTIN_TOOLS,
    permissions: opts.permissions,
    scope: opts.scope,
    cwd: opts.cwd,
    systemPrompt: SYSTEM_PROMPT,
    temperature: opts.temperature,
    maxSteps: opts.maxSteps,
    hooks: makeHooks(opts.recorder),
  });

  console.log("\n" + c.bold(c.green("● concluído")) + c.dim(` em ${result.steps} passo(s)`));
  if (result.hitLimit) {
    console.log(c.red("  (limite de passos atingido — a tarefa pode não ter terminado)"));
  }

  if (opts.recorder) {
    const path = saveSession(opts.recorder.session);
    console.log(
      c.dim("  sessão gravada: ") + c.violet(opts.recorder.session.id) +
        c.dim("  →  gere o relatório com ") + c.cyan(`nyx report`),
    );
    return { sessionId: opts.recorder.session.id, sessionPath: path };
  }
  return {};
}

export async function runCommand(task: string, flags: RunFlags): Promise<void> {
  const cfg = loadConfig();
  const providerId = flags.provider ?? cfg.defaultProvider;

  let provider;
  try {
    provider = createProvider(providerId, {
      apiKey: flags.apiKey ?? keyFromConfig(cfg, providerId),
      baseUrl: flags.baseUrl,
    });
  } catch (err) {
    if (err instanceof ProviderError) {
      console.error(c.red(`✗ ${err.message}`));
      console.error(c.dim("  Veja os providers com: nyx providers"));
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const model = resolveModel(cfg, providerId, flags.model);
  const cwd = flags.cwd ?? process.cwd();
  const policy = policyFromFlags(cfg.permissions ?? {}, flags);
  const scopeList = splitList(flags.scope);
  const scope = scopeList.length ? new ScopeGuard(scopeList) : undefined;
  const recorder =
    flags.record === false
      ? undefined
      : new Recorder({ provider: providerId, model, cwd, scope: scopeList });

  const rl = createInterface({ input: stdin, output: stdout });
  const permissions = buildPermissions(policy, { yes: flags.yes, rl });

  process.stdout.write(banner());
  console.log(
    c.dim("provider ") + c.violet(providerId) + c.dim("  ·  modelo ") + c.cyan(model) +
      c.dim("  ·  cwd ") + c.dim(cwd),
  );
  if (scope) console.log(c.dim("escopo: ") + c.gold(scopeList.join(", ")));
  console.log(c.bold("\n▶ tarefa: ") + task + "\n");

  try {
    await runAgentTask(task, {
      provider,
      model,
      cwd,
      permissions,
      scope,
      recorder,
      temperature: flags.temperature ? Number(flags.temperature) : undefined,
      maxSteps: flags.maxSteps ? Number(flags.maxSteps) : undefined,
    });
  } catch (err) {
    console.error(c.red(`\n✗ ${(err as Error).message}`));
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}
