import {
  ProviderError,
  createProvider,
  keyFromConfig,
  latestSession,
  loadConfig,
  loadSession,
  resolveModel,
  saveReport,
  type RecordedSession,
} from "@nyx/core";
import { c } from "../banner.js";

export interface ReportFlags {
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  lang?: string;
}

function cap(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max) + `\n…[+${text.length - max} chars]`;
}

/** Monta a evidência (comandos reais + saídas reais) pareando cada call ao seu result. */
function buildEvidence(session: RecordedSession, maxOut: number): string {
  const results = new Map<string, { output: string; status: string }>();
  for (const e of session.events) {
    if (e.type === "tool_result" && e.id) {
      results.set(e.id, { output: e.output ?? "", status: e.status ?? "ok" });
    }
  }

  const blocks: string[] = [];
  let n = 0;
  for (const e of session.events) {
    if (e.type === "tool_call") {
      n++;
      const res = e.id ? results.get(e.id) : undefined;
      const args = JSON.stringify(e.args ?? {}, null, 2);
      blocks.push(
        `#### Passo ${n} — \`${e.tool}\`\n` +
          "Entrada:\n```json\n" + cap(args, 1200) + "\n```\n" +
          `Saída (${res?.status ?? "sem resultado"}):\n` +
          "```\n" + cap(res?.output ?? "(sem saída)", maxOut) + "\n```",
      );
    } else if (e.type === "assistant" && e.text) {
      blocks.push(`> **Nyx:** ${e.text.trim()}`);
    }
  }
  return blocks.join("\n\n") || "(nenhuma ação registrada)";
}

const SYSTEM = (lang: string) =>
  "You are a senior security researcher writing a bug bounty vulnerability report. " +
  "You receive the recorded log of an autonomous testing session: the task, the EXACT commands/requests " +
  "executed, and their REAL outputs.\n\n" +
  "Produce ONE professional vulnerability report in Markdown with sections: " +
  "1) Title (vuln class + asset), 2) Severity (CVSS 3.1 score + vector string + label), " +
  "3) Affected Asset/Endpoint, 4) Summary, 5) Steps to Reproduce (numbered, referencing the real commands), " +
  "6) Proof of Concept (the concrete request/response or command/output proving it), 7) Impact, 8) Remediation.\n\n" +
  "STRICT RULES:\n" +
  "- Base everything ONLY on the provided evidence. Never invent requests, responses or outputs.\n" +
  "- If the evidence does not actually demonstrate a vulnerability, start with a clear " +
  "'⚠️ No confirmed vulnerability — insufficient evidence' and summarize what was attempted instead of fabricating a finding.\n" +
  "- Reproduction steps must be copy-pasteable and match the real commands.\n" +
  "- Be concise and technical.\n" +
  `Write the report in ${lang}.`;

export async function reportCommand(sessionId: string | undefined, flags: ReportFlags): Promise<void> {
  let session: RecordedSession | undefined;
  try {
    session = sessionId ? loadSession(sessionId) : latestSession();
  } catch {
    console.error(c.red(`✗ sessão não encontrada: ${sessionId}`));
    process.exitCode = 1;
    return;
  }
  if (!session) {
    console.log(
      c.dim("Nenhuma sessão gravada ainda. Rode uma tarefa autônoma primeiro: ") +
        c.cyan(`nyx run "..."`),
    );
    return;
  }

  const cfg = loadConfig();
  const providerId = flags.provider ?? session.provider ?? cfg.defaultProvider;
  const model = flags.model ?? session.model ?? resolveModel(cfg, providerId);
  const lang = flags.lang ?? "en";

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

  const evidence = buildEvidence(session, 3000);
  console.log(
    c.dim(`Gerando relatório da sessão `) + c.violet(session.id) +
      c.dim(` com ${providerId}/${model}…\n`),
  );

  let narrative: string;
  try {
    const res = await provider.chat({
      model,
      messages: [
        { role: "system", content: SYSTEM(lang) },
        {
          role: "user",
          content:
            `Program scope: ${session.scope.join(", ") || "(não declarado)"}\n` +
            `Task: ${session.task}\n` +
            `Engine: ${session.provider}/${session.model}\n\n` +
            `Captured evidence (flight recorder):\n\n${evidence}`,
        },
      ],
    });
    narrative = res.content;
  } catch (err) {
    console.error(c.red(`✗ ${(err as Error).message}`));
    process.exitCode = 1;
    return;
  }

  const markdown =
    narrative.trim() +
    "\n\n---\n\n" +
    "## Anexo — Flight Recorder (evidência bruta)\n\n" +
    `- **Sessão:** \`${session.id}\`\n` +
    `- **Data:** ${session.createdAt}\n` +
    `- **Engine:** ${session.provider} / ${session.model}\n` +
    `- **Escopo:** ${session.scope.join(", ") || "(não declarado)"}\n` +
    `- **Tarefa:** ${session.task}\n\n` +
    buildEvidence(session, 8000) +
    "\n";

  const path = saveReport(session.id, markdown);

  console.log(markdown);
  console.log(
    c.bold(c.green("\n● relatório gerado")) + c.dim("  →  ") + c.violet(path),
  );
}
