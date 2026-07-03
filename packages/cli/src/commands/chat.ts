import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { Agent, createProvider, loadConfig, resolveModel, keyFromConfig, ProviderError } from "@nyx/core";
import { banner, c } from "../banner.js";

export interface ChatFlags {
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  system?: string;
  temperature?: string;
  stream?: boolean;
}

function buildAgent(flags: ChatFlags): { agent: Agent; providerId: string; model: string } {
  const cfg = loadConfig();
  const providerId = flags.provider ?? cfg.defaultProvider;
  const provider = createProvider(providerId, {
    apiKey: flags.apiKey ?? keyFromConfig(cfg, providerId),
    baseUrl: flags.baseUrl,
  });
  const model = resolveModel(cfg, providerId, flags.model);
  const agent = new Agent({
    provider,
    model,
    systemPrompt: flags.system ?? cfg.systemPrompt,
    temperature: flags.temperature ? Number(flags.temperature) : undefined,
  });
  return { agent, providerId, model };
}

async function streamReply(agent: Agent, input: string, useStream: boolean): Promise<void> {
  if (useStream) {
    for await (const chunk of agent.sendStream(input)) {
      if (chunk.delta) stdout.write(chunk.delta);
    }
    stdout.write("\n");
  } else {
    const reply = await agent.send(input);
    console.log(reply);
  }
}

export async function chatCommand(prompt: string | undefined, flags: ChatFlags): Promise<void> {
  let ctx: ReturnType<typeof buildAgent>;
  try {
    ctx = buildAgent(flags);
  } catch (err) {
    if (err instanceof ProviderError) {
      console.error(c.red(`✗ ${err.message}`));
      console.error(c.dim("  Veja os providers disponíveis com: nyx providers"));
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
  console.log(
    c.dim(`provider `) + c.violet(ctx.providerId) + c.dim(`  ·  modelo `) + c.cyan(ctx.model),
  );
  console.log(c.dim(`Digite sua mensagem. /reset limpa o contexto, /sair encerra.\n`));

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    while (true) {
      const input = (await rl.question(c.violet("você › "))).trim();
      if (!input) continue;
      if (input === "/sair" || input === "/exit" || input === "/quit") break;
      if (input === "/reset") {
        ctx.agent.reset();
        console.log(c.dim("contexto limpo.\n"));
        continue;
      }
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
