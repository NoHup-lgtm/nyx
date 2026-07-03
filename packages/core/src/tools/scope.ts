/**
 * Guarda de escopo: garante que o agente só interaja com alvos de REDE
 * autorizados (hosts/domínios/IPs). Peça-chave pro público de bug bounty —
 * sair do escopo de um programa = ban.
 *
 * Importante: o escopo restringe apenas ações de rede. Nomes de arquivo locais
 * (server.go, package.json, etc.) NÃO são alvos e nunca são bloqueados por aqui.
 */
export class ScopeGuard {
  private readonly patterns: string[];

  /** Ferramentas de linha de comando cujos argumentos podem ser hosts. */
  private static readonly NET_TOOLS = new Set([
    "curl", "wget", "nc", "ncat", "netcat", "ping", "ping6", "nmap", "masscan",
    "rustscan", "dig", "host", "nslookup", "telnet", "ssh", "scp", "sftp", "ftp",
    "ffuf", "gobuster", "feroxbuster", "dirb", "dirbuster", "nikto", "sqlmap",
    "whatweb", "httpx", "nuclei", "wpscan", "amass", "subfinder", "wfuzz",
    "hydra", "medusa", "traceroute", "mtr", "openssl",
  ]);

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
    const h = host.toLowerCase().replace(/\.$/, "").replace(/:\d+$/, "");
    return this.patterns.some((p) => {
      if (p.startsWith("*.")) {
        const base = p.slice(2);
        return h === base || h.endsWith("." + base);
      }
      return h === p || h.endsWith("." + p);
    });
  }

  /** Extrai apenas hosts de REDE de um comando shell (URLs, user@host, args de net-tools). */
  private hostsFromShell(cmd: string): string[] {
    const hosts = new Set<string>();
    const clean = (h: string) => h.split("@").pop()!.split("/")[0]!.replace(/:\d+$/, "").toLowerCase();

    // 1) URLs com esquema (http://, https://, ftp://, etc.)
    const urlRe = /[a-z][a-z0-9+.\-]*:\/\/([^\s"'`|>)\]]+)/gi;
    for (let m = urlRe.exec(cmd); m; m = urlRe.exec(cmd)) {
      if (m[1]) hosts.add(clean(m[1]));
    }

    // 2) user@host (ssh/scp)
    const atRe = /\b[\w.\-]+@((?:[a-z0-9-]+\.)+[a-z]{2,}|\d{1,3}(?:\.\d{1,3}){3})\b/gi;
    for (let m = atRe.exec(cmd); m; m = atRe.exec(cmd)) {
      if (m[1]) hosts.add(m[1].toLowerCase());
    }

    // 3) argumentos "crus" (host/IP) passados a ferramentas de rede conhecidas
    const tokens = cmd.split(/[\s;|&(){}<>]+/).filter(Boolean);
    const usesNetTool = tokens.some((t) => ScopeGuard.NET_TOOLS.has(t.replace(/^.*\//, "")));
    if (usesNetTool) {
      const hostLike =
        /^(?:(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/i;
      for (const t of tokens) {
        if (t.startsWith("-") || t.includes("/")) continue; // flags e paths não são hosts
        if (hostLike.test(t)) hosts.add(t.replace(/:\d+$/, "").toLowerCase());
      }
    }

    return [...hosts];
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
      const outside = this.hostsFromShell(cmd).filter((h) => !this.hostAllowed(h));
      if (outside.length) {
        return { allowed: false, detail: `alvo(s) de rede fora do escopo: ${outside.join(", ")}` };
      }
      return { allowed: true };
    }

    // read_file / write_file / list_dir não são ações de rede — não restringidos.
    return { allowed: true };
  }
}
