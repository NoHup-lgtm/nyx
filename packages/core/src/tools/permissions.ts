import type { Tool } from "./types.js";

export type Decision = "allow" | "deny" | "ask";

export interface PermissionPolicy {
  /** Decisão para ferramentas sem regra específica. */
  default: Decision;
  /** Override por nome de ferramenta. */
  tools: Record<string, Decision>;
}

/**
 * Padrão seguro: leitura e rede liberadas; qualquer coisa que escreve ou
 * executa comando pede confirmação. Público de segurança pode afrouxar/apertar
 * isso no ~/.nyx/config.json ou por flag.
 */
export const DEFAULT_POLICY: PermissionPolicy = {
  default: "ask",
  tools: {
    read_file: "allow",
    list_dir: "allow",
    http_fetch: "allow",
    write_file: "ask",
    shell: "ask",
  },
};

export interface PermissionRequest {
  tool: Tool;
  input: Record<string, unknown>;
}

/**
 * Callback que resolve uma decisão "ask" (ex.: prompt no CLI). Recebe o pedido
 * e devolve true (permitir) / false (negar).
 */
export type Confirmer = (req: PermissionRequest) => Promise<boolean>;

export class PermissionManager {
  constructor(
    private readonly policy: PermissionPolicy,
    private readonly confirm?: Confirmer,
  ) {}

  /** Decisão estática configurada para uma ferramenta. */
  decisionFor(toolName: string): Decision {
    return this.policy.tools[toolName] ?? this.policy.default;
  }

  /** Resolve se um pedido específico pode rodar, consultando o usuário se preciso. */
  async authorize(req: PermissionRequest): Promise<boolean> {
    const decision = this.decisionFor(req.tool.name);
    if (decision === "allow") return true;
    if (decision === "deny") return false;
    if (!this.confirm) return false; // "ask" sem quem responder = nega por segurança
    return this.confirm(req);
  }
}

/** Mescla uma policy parcial (ex.: vinda do config) com os padrões seguros. */
export function resolvePolicy(partial?: Partial<PermissionPolicy>): PermissionPolicy {
  return {
    default: partial?.default ?? DEFAULT_POLICY.default,
    tools: { ...DEFAULT_POLICY.tools, ...(partial?.tools ?? {}) },
  };
}
