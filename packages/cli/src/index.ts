#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { banner } from "./banner.js";
import { chatCommand, type ChatFlags } from "./commands/chat.js";
import { providersCommand } from "./commands/providers.js";
import { configSet, configShow } from "./commands/config.js";

// Carrega um .env do diretório atual, se existir (sem dependência externa).
const envPath = join(process.cwd(), ".env");
if (existsSync(envPath) && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(envPath);
  } catch {
    /* ignora .env malformado */
  }
}

const program = new Command();

program
  .name("nyx")
  .description("Nyx — agente de IA autônomo e provider-agnostic.")
  .version("0.1.0");

program
  .command("chat")
  .description("Conversa com o agente (interativo ou one-shot).")
  .argument("[prompt]", "mensagem única; se omitida, abre o modo interativo")
  .option("-p, --provider <id>", "provider a usar (openai, openrouter, nvidia, anthropic, ollama)")
  .option("-m, --model <model>", "modelo específico")
  .option("-k, --api-key <key>", "chave de API explícita (sobrepõe o ambiente)")
  .option("-b, --base-url <url>", "endpoint custom (gateway próprio / self-hosted)")
  .option("-s, --system <prompt>", "system prompt")
  .option("-t, --temperature <n>", "temperatura de amostragem")
  .option("--no-stream", "desativa o streaming de resposta")
  .action((prompt: string | undefined, flags: ChatFlags) => chatCommand(prompt, flags));

program
  .command("providers")
  .description("Lista os providers suportados e quais já têm chave configurada.")
  .action(() => providersCommand());

const config = program.command("config").description("Mostra ou altera a configuração do Nyx.");
config
  .command("show", { isDefault: true })
  .description("Exibe a configuração atual.")
  .action(() => configShow());
config
  .command("set <key> <value>")
  .description("Define defaultProvider, defaultModel ou systemPrompt.")
  .action((key: string, value: string) => configSet(key, value));

if (process.argv.length <= 2) {
  process.stdout.write(banner());
  program.help();
}

program.parseAsync(process.argv);
