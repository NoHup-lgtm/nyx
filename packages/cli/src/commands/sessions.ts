import { listSessions } from "@nyx/core";
import { c } from "../banner.js";

export function sessionsCommand(): void {
  const sessions = listSessions();
  if (!sessions.length) {
    console.log(
      c.dim("Nenhuma sessão gravada. Rode uma tarefa autônoma: ") + c.cyan(`nyx run "..."`),
    );
    return;
  }

  console.log(c.bold(`Sessões gravadas (${sessions.length}):\n`));
  for (const s of sessions) {
    const when = s.createdAt.replace("T", " ").slice(0, 16);
    const task = s.task.length > 60 ? s.task.slice(0, 57) + "…" : s.task;
    console.log(
      `  ${c.violet(s.id)}  ${c.dim(when)}  ${c.dim(`${s.provider} · ${s.events} eventos`)}`,
    );
    console.log(`    ${task || c.dim("(sem tarefa)")}`);
  }
  console.log(c.dim("\nGere o relatório de uma sessão: ") + c.cyan("nyx report <id>"));
}
