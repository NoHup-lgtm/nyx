#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { chatCommand, type ChatFlags } from "./commands/chat.js";
import { runCommand, type RunFlags } from "./commands/run.js";
import { modelsCommand, type ModelsFlags } from "./commands/models.js";
import { homeCommand } from "./commands/home.js";
import { runSetup } from "./commands/setup.js";
import { providersCommand } from "./commands/providers.js";
import { toolsCommand } from "./commands/tools.js";
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
  .command("setup")
  .description("Configura providers, chaves de API e modelos (wizard interativo).")
  .action(() => runSetup());

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
  .command("run")
  .description("Executa uma tarefa de forma autônoma, usando ferramentas (shell, arquivos, rede).")
  .argument("<task>", "descrição da tarefa a executar")
  .option("-p, --provider <id>", "provider a usar")
  .option("-m, --model <model>", "modelo específico")
  .option("-k, --api-key <key>", "chave de API explícita")
  .option("-b, --base-url <url>", "endpoint custom")
  .option("-t, --temperature <n>", "temperatura de amostragem")
  .option("--max-steps <n>", "máximo de passos do loop (padrão 12)")
  .option("--cwd <dir>", "diretório de trabalho para as tools")
  .option("-y, --yes", "aprova automaticamente as tools em modo 'ask' (respeita 'deny')")
  .option("--allow <tools>", "libera tools (nomes separados por vírgula, ou 'all')")
  .option("--deny <tools>", "bloqueia tools (nomes separados por vírgula, ou 'all')")
  .action((task: string, flags: RunFlags) => runCommand(task, flags));

program
  .command("models")
  .description("Lista os modelos disponíveis no provider (com filtro opcional).")
  .argument("[filter]", "filtra por substring (ex.: llama, glm, gpt)")
  .option("-p, --provider <id>", "provider a consultar")
  .option("-k, --api-key <key>", "chave de API explícita")
  .option("-b, --base-url <url>", "endpoint custom")
  .action((filter: string | undefined, flags: ModelsFlags) => modelsCommand(filter, flags));

program
  .command("tools")
  .description("Lista as ferramentas disponíveis e a permissão atual de cada uma.")
  .action(() => toolsCommand());

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

// `nyx` sem argumentos → interface interativa (home). Com argumentos → comandos.
if (process.argv.length <= 2) {
  homeCommand();
} else {
  program.parseAsync(process.argv);
}
