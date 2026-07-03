import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, readdir, mkdir, stat } from "node:fs/promises";
import { isAbsolute, join, dirname } from "node:path";
import type { Tool, ToolContext } from "./types.js";
import { truncate } from "./types.js";

const execAsync = promisify(exec);

function resolvePath(p: string, ctx: ToolContext): string {
  return isAbsolute(p) ? p : join(ctx.cwd, p);
}

export const shellTool: Tool = {
  name: "shell",
  description:
    "Executa um comando shell no diretório de trabalho e retorna stdout+stderr. " +
    "Use para inspecionar sistemas, rodar ferramentas de linha de comando, etc.",
  risk: "exec",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "O comando a executar." },
      timeout_ms: { type: "number", description: "Timeout em ms (padrão 60000)." },
    },
    required: ["command"],
  },
  async execute(input, ctx) {
    const command = String(input.command ?? "");
    const timeout = Number(input.timeout_ms ?? 60_000);
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: ctx.cwd,
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        signal: ctx.signal,
      });
      const out = [stdout, stderr && `[stderr]\n${stderr}`].filter(Boolean).join("\n");
      return truncate(out.trim() || "(sem saída)");
    } catch (err: any) {
      const parts = [
        `exit code: ${err.code ?? "?"}`,
        err.stdout && `[stdout]\n${err.stdout}`,
        err.stderr && `[stderr]\n${err.stderr}`,
        !err.stdout && !err.stderr && err.message,
      ].filter(Boolean);
      return truncate(parts.join("\n"));
    }
  },
};

export const readFileTool: Tool = {
  name: "read_file",
  description: "Lê o conteúdo de um arquivo de texto.",
  risk: "read",
  parameters: {
    type: "object",
    properties: { path: { type: "string", description: "Caminho do arquivo." } },
    required: ["path"],
  },
  async execute(input, ctx) {
    const path = resolvePath(String(input.path ?? ""), ctx);
    const content = await readFile(path, "utf8");
    return truncate(content);
  },
};

export const writeFileTool: Tool = {
  name: "write_file",
  description: "Escreve (ou sobrescreve) um arquivo de texto, criando diretórios se preciso.",
  risk: "write",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Caminho do arquivo." },
      content: { type: "string", description: "Conteúdo a escrever." },
    },
    required: ["path", "content"],
  },
  async execute(input, ctx) {
    const path = resolvePath(String(input.path ?? ""), ctx);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, String(input.content ?? ""), "utf8");
    return `Arquivo escrito: ${path} (${String(input.content ?? "").length} chars)`;
  },
};

export const listDirTool: Tool = {
  name: "list_dir",
  description: "Lista os arquivos e pastas de um diretório.",
  risk: "read",
  parameters: {
    type: "object",
    properties: { path: { type: "string", description: "Caminho do diretório (padrão: cwd)." } },
  },
  async execute(input, ctx) {
    const path = resolvePath(String(input.path ?? "."), ctx);
    const entries = await readdir(path, { withFileTypes: true });
    const lines = await Promise.all(
      entries.map(async (e) => {
        const kind = e.isDirectory() ? "dir " : "file";
        let size = "";
        if (e.isFile()) {
          try {
            size = ` ${(await stat(join(path, e.name))).size}b`;
          } catch {
            /* ignora */
          }
        }
        return `${kind} ${e.name}${size}`;
      }),
    );
    return truncate(lines.join("\n") || "(vazio)");
  },
};

export const httpFetchTool: Tool = {
  name: "http_fetch",
  description: "Faz uma requisição HTTP e retorna status, headers e corpo (texto).",
  risk: "network",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL completa." },
      method: { type: "string", description: "Método HTTP (padrão GET)." },
      headers: { type: "object", description: "Headers como pares chave/valor." },
      body: { type: "string", description: "Corpo da requisição, se houver." },
    },
    required: ["url"],
  },
  async execute(input, ctx) {
    const res = await fetch(String(input.url), {
      method: String(input.method ?? "GET"),
      headers: (input.headers as Record<string, string>) ?? undefined,
      body: input.body ? String(input.body) : undefined,
      signal: ctx.signal,
    });
    const text = await res.text();
    const headerLines = [...res.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n");
    return truncate(`HTTP ${res.status} ${res.statusText}\n${headerLines}\n\n${text}`);
  },
};

/** Todas as tools embutidas. */
export const BUILTIN_TOOLS: Tool[] = [
  shellTool,
  readFileTool,
  writeFileTool,
  listDirTool,
  httpFetchTool,
];
