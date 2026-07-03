/**
 * Guarda de escopo: garante que o agente só interaja com alvos autorizados
 * (hosts/domínios/IPs). Peça-chave pro público de bug bounty — sair do escopo
 * de um programa = ban.
 */
export class ScopeGuard {
  private readonly patterns: string[];

  constructor(patterns: string[]) {
    this.patterns = patterns.map((p) => p.toLowerCase().trim()).filter(Boolean);
  }

  /** True se um escopo foi definido (senão, não há restrição). */
  get active(): boolean {
    return this.patterns.length > 0;
  }

  get list(): string[] {
    return [...this.patterns];
  }

  /** Um host casa com o escopo? Suporta wildcard `*.dominio` e subdomínios. */
  hostAllowed(host: string): boolean {
    const h = host.toLowerCase().replace(/\.$/, "");
    return this.patterns.some((p) => {
      if (p.startsWith("*.")) {
        const base = p.slice(2);
        return h === base || h.endsWith("." + base);
      }
      // Domínio "cru" cobre ele mesmo e seus subdomínios.
      return h === p || h.endsWith("." + p);
    });
  }

  private extractHosts(text: string): string[] {
    const domains = text.match(/\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi) ?? [];
    const ips = text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) ?? [];
    return [...new Set([...domains, ...ips].map((s) => s.toLowerCase()))];
  }

  /** Avalia um pedido de tool. Retorna se está no escopo e o motivo se não. */
  check(toolName: string, input: Record<string, unknown>): { allowed: boolean; detail?: string } {
    if (!this.active) return { allowed: true };

    if (toolName === "http_fetch") {
      const raw = String(input.url ?? "");
      let host: string;
      try {
        host = new URL(raw).hostname;
      } catch {
        return { allowed: false, detail: `URL inválida: ${raw}` };
      }
      return this.hostAllowed(host)
        ? { allowed: true }
        : { allowed: false, detail: `host fora do escopo: ${host}` };
    }

    if (toolName === "shell") {
      const cmd = String(input.command ?? "");
      const hosts = this.extractHosts(cmd);
      const outside = hosts.filter((h) => !this.hostAllowed(h));
      if (outside.length) {
        return { allowed: false, detail: `alvo(s) fora do escopo: ${outside.join(", ")}` };
      }
      return { allowed: true };
    }

    // read_file / write_file / list_dir não são restringidos por host.
    return { allowed: true };
  }
}
