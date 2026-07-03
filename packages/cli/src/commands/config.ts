import { CONFIG_PATH, loadConfig, saveConfig } from "@nyx/core";
import { c } from "../banner.js";

const SETTABLE = ["defaultProvider", "defaultModel", "systemPrompt"] as const;
type SettableKey = (typeof SETTABLE)[number];

export function configShow(): void {
  const cfg = loadConfig();
  console.log(c.dim(`# ${CONFIG_PATH}\n`));
  console.log(JSON.stringify(cfg, null, 2));
}

export function configSet(key: string, value: string): void {
  if (!SETTABLE.includes(key as SettableKey)) {
    console.error(
      c.red(`Chave inválida: ${key}. Aceitas: ${SETTABLE.join(", ")}`),
    );
    process.exitCode = 1;
    return;
  }
  const cfg = loadConfig();
  (cfg as unknown as Record<string, unknown>)[key] = value;
  saveConfig(cfg);
  console.log(c.green(`✓ ${key} = ${value}`));
}
