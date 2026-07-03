import { createInterface, type Interface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  Agent,
  PROVIDER_SPECS,
  ProviderError,
  Recorder,
  ScopeGuard,
  createProvider,
  keyFromConfig,
  loadConfig,
  resolveModel,
  resolvePolicy,
  type Message,
  type Provider,
} from "@nyx/core";
import { banner, statusLine, c } from "../banner.js";
import { buildPermissions, runAgentTask } from "./run.js";
import { toolsCommand } from "./tools.js";
import { reportCommand } from "./report.js";
import { sessionsCommand } from "./sessions.js";

export interface ChatFlags {
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  system?: string;
  temperature?: string;
  stream?: boolean;
}

interface Ctx {
  agent: Agent;
  provider: Provider;
  providerId: string;
  model: string;
}

function makeCtx(
  providerId: string,
  modelOverride: string | undefined,
  flags: ChatFlags,
  history?: Message[],
): Ctx {
  const cfg = loadConfig();
  const provider = createProvider(providerId, {
    apiKey: flags.apiKey ?? keyFromConfig(cfg, providerId),
    baseUrl: flags.baseUrl,
  });
  const model = modelOverride ?? resolveModel(cfg, providerId, flags.model);
  const agent = new Agent({
    provider,
    model,
    systemPrompt: flags.system ?? cfg.systemPrompt,
    temperature: flags.temperature ? Number(flags.temperature) : undefined,
  });
  if (history) agent.restore(history);
  return { agent, provider, providerId, model };
}

async function streamReply(agent: Agent, input: string, useStream: boolean): Promise<void> {
  if (useStream) {
    for await (const chunk of agent.sendStream(input)) {
      if (chunk.delta) stdout.write(chunk.delta);
    }
    stdout.write("\n");
  } else {
    console.log(await agent.send(input));
  }
}

const HELP = [
  ["/help", "mostra esta ajuda"],
  ["/info", "provider e modelo atuais (a fonte da verdade)"],
  ["/models [filtro]", "lista os modelos do provider (sem sair)"],
  ["/model <id>", "troca o modelo mantendo a conversa"],
  ["/provider <id> [modelo]", "troca de provider mantendo a conversa"],
  ["/run <tarefa>", "executa uma tarefa autônoma (grava a sessão)"],
  ["/scope <hosts>", "define o escopo autorizado do /run (ou limpa se vazio)"],
  ["/report [id]", "gera relatório/PoC da última sessão (ou de <id>)"],
  ["/sessions", "lista as sessões gravadas"],
  ["/tools", "lista as ferramentas e permissões"],
  ["/reset", "limpa o contexto da conversa"],
  ["/clear", "limpa a tela"],
  ["/sair", "encerra"],
];

function printHelp(): void {
  console.log(c.bold("Comandos:"));
  for (const [cmd, desc] of HELP) {
    console.log("  " + c.cyan((cmd as string).padEnd(26)) + c.dim(desc as string));
  }
  console.log("");
}

async function listModels(ctx: Ctx, filter: string): Promise<void> {
  if (!ctx.provider.listModels) {
    console.log(c.dim(`O provider ${ctx.providerId} não expõe listagem de modelos.\n`));
    return;
  }
  try {
    let models = await ctx.provider.listModels();
    if (filter) models = models.filter((m) => m.toLowerCase().includes(filter.toLowerCase()));
    if (!models.length) {
      console.log(c.dim(`Nenhum modelo${filter ? ` com "${filter}"` : ""}.\n`));
      return;
    }
    console.log(c.bold(`Modelos em ${c.violet(ctx.providerId)}`) + c.dim(` (${models.length}):`));
    for (const m of models) console.log("  " + c.cyan(m));
    console.log(c.dim("troque com ") + c.cyan("/model <id>") + "\n");
  } catch (err) {
    console.log(c.red(`✗ ${(err as Error).message}\n`));
  }
}

export async function chatCommand(prompt: string | undefined, flags: ChatFlags): Promise<void> {
  let ctx: Ctx;
  try {
    ctx = makeCtx(flags.provider ?? loadConfig().defaultProvider, undefined, flags);
  } catch (err) {
    if (err instanceof ProviderError) {
      console.error(c.red(`✗ ${err.message}`));
      console.error(c.dim("  Configure com: nyx setup"));
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const useStream = flags.stream !== false;

  // Modo one-shot: prompt passado como argumento.
  if (prompt) {
    try {
      await streamReply(ctx.agent, prompt, useStream);
    } catch (err) {
      console.error(c.red(`✗ ${(err as Error).message}`));
      process.exitCode = 1;
    }
    return;
  }

  // Modo interativo (REPL).
  process.stdout.write(banner());
  console.log(statusLine(ctx.providerId, ctx.model));
  console.log(c.dim("Digite ") + c.cyan("/help") + c.dim(" para os comandos, ou fale normalmente.\n"));

  const rl = createInterface({ input: stdin, output: stdout });
  let scope: string[] = [];
  try {
    while (true) {
      const input = (await rl.question(c.violet("você › "))).trim();
      if (!input) continue;

      if (input.startsWith("/")) {
        const parts = input.slice(1).split(/\s+/);
        const cmd = (parts[0] ?? "").toLowerCase();
        const arg = parts.slice(1).join(" ").trim();

        if (cmd === "sair" || cmd === "exit" || cmd === "quit") break;
        if (cmd === "help" || cmd === "h" || cmd === "?") {
          printHelp();
        } else if (cmd === "info" || cmd === "status") {
          console.log(
            statusLine(ctx.providerId, ctx.model) +
              c.dim("  (fonte da verdade — não pergunte ao modelo, ele chuta)\n"),
          );
        } else if (cmd === "reset") {
          ctx.agent.reset();
          console.log(c.dim("contexto limpo.\n"));
        } else if (cmd === "clear") {
          console.clear();
        } else if (cmd === "tools") {
          toolsCommand();
          console.log("");
        } else if (cmd === "models") {
          await listModels(ctx, arg);
        } else if (cmd === "model") {
          if (!arg) {
            console.log(c.dim(`modelo atual: ${c.cyan(ctx.model)} — use /model <id> para trocar\n`));
          } else {
            ctx = makeCtx(ctx.providerId, arg, flags, ctx.agent.snapshot());
            console.log(c.green(`✓ modelo → ${ctx.model}`) + c.dim(" (conversa mantida)\n"));
          }
        } else if (cmd === "provider") {
          const [pid, ...m] = arg.split(/\s+/);
          const modelArg = m.join(" ").trim() || undefined;
          const spec = pid ? PROVIDER_SPECS[pid] : undefined;
          if (!pid || !spec) {
            console.log(
              c.red(`provider inválido. `) +
                c.dim("disponíveis: " + Object.keys(PROVIDER_SPECS).join(", ") + "\n"),
            );
          } else {
            const newModel = modelArg ?? spec.defaultModel;
            try {
              ctx = makeCtx(pid, newModel, flags, ctx.agent.snapshot());
              console.log(
                c.green(`✓ provider → ${ctx.providerId}`) +
                  c.dim(`  ·  modelo ${ctx.model}  (conversa mantida)\n`),
              );
            } catch (err) {
              console.log(
                c.red(`✗ ${(err as Error).message}`) +
                  c.dim(`\n  configure a chave com: nyx setup\n`),
              );
            }
          }
        } else if (cmd === "scope") {
          scope = arg.split(/[\s,]+/).filter(Boolean);
          console.log(
            scope.length
              ? c.gold(`escopo: ${scope.join(", ")}`) + c.dim("  (aplicado ao /run)\n")
              : c.dim("escopo limpo — /run sem restrição de alvo\n"),
          );
        } else if (cmd === "sessions") {
          sessionsCommand();
          console.log("");
        } else if (cmd === "report") {
          await reportCommand(arg || undefined, {});
          console.log("");
        } else if (cmd === "run") {
          if (!arg) {
            console.log(c.dim("uso: /run <descrição da tarefa>\n"));
          } else {
            const permissions = buildPermissions(resolvePolicy(loadConfig().permissions), { rl });
            const guard = scope.length ? new ScopeGuard(scope) : undefined;
            const recorder = new Recorder({
              provider: ctx.providerId,
              model: ctx.model,
              cwd: process.cwd(),
              scope,
            });
            try {
              await runAgentTask(arg, {
                provider: ctx.provider,
                model: ctx.model,
                cwd: process.cwd(),
                permissions,
                scope: guard,
                recorder,
              });
              console.log("");
            } catch (err) {
              console.log(c.red(`✗ ${(err as Error).message}\n`));
            }
          }
        } else {
          console.log(c.dim(`comando desconhecido: /${cmd} — use /help\n`));
        }
        continue;
      }

      // Mensagem normal → conversa.
      stdout.write(c.cyan("nyx › "));
      try {
        await streamReply(ctx.agent, input, useStream);
      } catch (err) {
        console.error(c.red(`✗ ${(err as Error).message}`));
      }
      stdout.write("\n");
    }
  } finally {
    rl.close();
  }
}
