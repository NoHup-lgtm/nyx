import { AnthropicProvider } from "./anthropic.js";
import { OpenAICompatibleProvider } from "./openai-compatible.js";
import { type Provider, ProviderError } from "./types.js";

export type ProviderKind = "openai-compatible" | "anthropic";

export interface ProviderSpec {
  id: string;
  label: string;
  kind: ProviderKind;
  baseUrl: string;
  /** Variáveis de ambiente aceitas para a chave, em ordem de prioridade. */
  envKeys: string[];
  /** Modelo sugerido quando o usuário não especifica um. */
  defaultModel: string;
  docsUrl: string;
  /** Provider local que dispensa chave (ex.: Ollama). */
  keyless?: boolean;
}

/**
 * Catálogo dos providers suportados de fábrica. Adicionar um novo provider
 * OpenAI-compatible é só acrescentar uma entrada aqui.
 */
export const PROVIDER_SPECS: Record<string, ProviderSpec> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    kind: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    envKeys: ["OPENAI_API_KEY", "NYX_OPENAI_API_KEY"],
    defaultModel: "gpt-4o-mini",
    docsUrl: "https://platform.openai.com/docs",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    kind: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    envKeys: ["OPENROUTER_API_KEY", "NYX_OPENROUTER_API_KEY"],
    defaultModel: "openai/gpt-4o-mini",
    docsUrl: "https://openrouter.ai/docs",
  },
  nvidia: {
    id: "nvidia",
    label: "NVIDIA NIM",
    kind: "openai-compatible",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    envKeys: ["NVIDIA_API_KEY", "NVIDIA_NIM_API_KEY", "NYX_NVIDIA_API_KEY"],
    defaultModel: "meta/llama-3.1-70b-instruct",
    docsUrl: "https://build.nvidia.com",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic (Claude)",
    kind: "anthropic",
    baseUrl: "https://api.anthropic.com",
    envKeys: ["ANTHROPIC_API_KEY", "NYX_ANTHROPIC_API_KEY"],
    defaultModel: "claude-3-5-sonnet-latest",
    docsUrl: "https://docs.anthropic.com",
  },
  ollama: {
    id: "ollama",
    label: "Ollama (local)",
    kind: "openai-compatible",
    baseUrl: "http://localhost:11434/v1",
    envKeys: [],
    defaultModel: "llama3.1",
    docsUrl: "https://ollama.com",
    keyless: true,
  },
};

export interface ResolveOptions {
  /** Chave explícita; se ausente, procura nas envKeys do spec. */
  apiKey?: string;
  /** baseUrl custom (ex.: gateway próprio, endpoint self-hosted). */
  baseUrl?: string;
  env?: NodeJS.ProcessEnv;
}

/** Procura a chave de um provider no ambiente, respeitando a ordem de envKeys. */
export function resolveApiKey(
  spec: ProviderSpec,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  for (const key of spec.envKeys) {
    const val = env[key];
    if (val) return val;
  }
  return undefined;
}

/** Constrói uma instância de Provider pronta pra usar a partir do id. */
export function createProvider(id: string, opts: ResolveOptions = {}): Provider {
  const spec = PROVIDER_SPECS[id];
  if (!spec) {
    const known = Object.keys(PROVIDER_SPECS).join(", ");
    throw new ProviderError(`Provider desconhecido: "${id}". Disponíveis: ${known}`, id);
  }

  const env = opts.env ?? process.env;
  const apiKey = opts.apiKey ?? resolveApiKey(spec, env);
  const baseUrl = opts.baseUrl ?? spec.baseUrl;

  if (!apiKey && !spec.keyless) {
    throw new ProviderError(
      `Sem chave para ${spec.label}. Defina ${spec.envKeys[0]} no ambiente ou passe --api-key.`,
      id,
    );
  }

  if (spec.kind === "anthropic") {
    return new AnthropicProvider({ id: spec.id, label: spec.label, baseUrl, apiKey: apiKey! });
  }

  const headers =
    spec.id === "openrouter"
      ? { "HTTP-Referer": "https://github.com/nyx", "X-Title": "Nyx" }
      : undefined;

  return new OpenAICompatibleProvider({
    id: spec.id,
    label: spec.label,
    baseUrl,
    apiKey: apiKey ?? "",
    headers,
  });
}

/** Lista os providers e diz quais já têm chave configurada no ambiente. */
export function providerStatus(
  env: NodeJS.ProcessEnv = process.env,
): { spec: ProviderSpec; ready: boolean }[] {
  return Object.values(PROVIDER_SPECS).map((spec) => ({
    spec,
    ready: spec.keyless || Boolean(resolveApiKey(spec, env)),
  }));
}
