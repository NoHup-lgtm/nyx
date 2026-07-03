import { createProvider, keyFromConfig, loadConfig, ProviderError } from "@nyx/core";
import { c } from "../banner.js";

export interface ModelsFlags {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
}

/** Lista os modelos disponíveis no provider (útil pra achar o ID certo). */
export async function modelsCommand(filter: string | undefined, flags: ModelsFlags): Promise<void> {
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
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  if (!provider.listModels) {
    console.log(c.dim(`O provider ${providerId} não expõe listagem de modelos.`));
    return;
  }

  try {
    let models = await provider.listModels();
    const needle = filter?.toLowerCase();
    if (needle) models = models.filter((m) => m.toLowerCase().includes(needle));

    if (!models.length) {
      console.log(c.dim(`Nenhum modelo${filter ? ` com "${filter}"` : ""} em ${providerId}.`));
      return;
    }

    console.log(
      c.bold(`Modelos em ${c.violet(providerId)}`) +
        c.dim(` (${models.length}${filter ? ` · filtro "${filter}"` : ""}):\n`),
    );
    for (const m of models) console.log("  " + c.cyan(m));
    console.log(c.dim(`\nUse com: `) + c.cyan(`nyx setup`) + c.dim(` ou `) + c.cyan(`nyx chat -m <id>`));
  } catch (err) {
    console.error(c.red(`✗ ${(err as Error).message}`));
    process.exitCode = 1;
  }
}
