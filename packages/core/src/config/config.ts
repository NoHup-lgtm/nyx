import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { PROVIDER_SPECS } from "../providers/registry.js";
import type { PermissionPolicy } from "../tools/permissions.js";

export interface NyxConfig {
  /** Provider padrão quando não passado via flag. */
  defaultProvider: string;
  /** Modelo padrão; se vazio, usa o defaultModel do spec do provider. */
  defaultModel?: string;
  /** System prompt padrão do agente. */
  systemPrompt?: string;
  /** Overrides por provider (baseUrl custom, etc.). */
  providers?: Record<string, { baseUrl?: string }>;
  /** Política de permissões das tools (mesclada com os padrões seguros). */
  permissions?: Partial<PermissionPolicy>;
  /** Chaves de API por provider, salvas pelo `nyx setup` (arquivo com modo 600). */
  keys?: Record<string, string>;
}

export const CONFIG_DIR = join(homedir(), ".nyx");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");

const DEFAULTS: NyxConfig = {
  defaultProvider: "openrouter",
  defaultModel: "",
  systemPrompt:
    "Você é Nyx, um assistente de IA direto e técnico. Responda com objetividade.",
  providers: {},
};

/** Lê o config do disco, mesclado com padrões e overrides de ambiente. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): NyxConfig {
  let fromFile: Partial<NyxConfig> = {};
  if (existsSync(CONFIG_PATH)) {
    try {
      fromFile = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    } catch {
      // Config corrompido: ignora e segue com os padrões.
    }
  }

  const cfg: NyxConfig = { ...DEFAULTS, ...fromFile };
  if (env.NYX_DEFAULT_PROVIDER) cfg.defaultProvider = env.NYX_DEFAULT_PROVIDER;
  if (env.NYX_DEFAULT_MODEL) cfg.defaultModel = env.NYX_DEFAULT_MODEL;
  return cfg;
}

export function saveConfig(cfg: NyxConfig): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  // Modo 600: o arquivo pode conter chaves de API.
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  try {
    chmodSync(CONFIG_PATH, 0o600);
  } catch {
    /* fs sem suporte a chmod (ex.: Windows) — ignora */
  }
}

/** Resolve a chave de um provider: config (nyx setup) tem prioridade sobre o ambiente. */
export function keyFromConfig(cfg: NyxConfig, providerId: string): string | undefined {
  return cfg.keys?.[providerId];
}

/** Resolve qual modelo usar: flag > config > default do provider. */
export function resolveModel(cfg: NyxConfig, providerId: string, modelFlag?: string): string {
  if (modelFlag) return modelFlag;
  if (cfg.defaultModel) return cfg.defaultModel;
  const spec = PROVIDER_SPECS[providerId];
  return spec?.defaultModel ?? "";
}
