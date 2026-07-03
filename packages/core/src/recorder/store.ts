import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR } from "../config/config.js";
import type { RecordedSession } from "./session.js";

export const SESSIONS_DIR = join(CONFIG_DIR, "sessions");
export const REPORTS_DIR = join(CONFIG_DIR, "reports");

function pathFor(id: string): string {
  return join(SESSIONS_DIR, `${id}.json`);
}

/** Salva a sessão em ~/.nyx/sessions/<id>.json e devolve o caminho. */
export function saveSession(session: RecordedSession): string {
  mkdirSync(SESSIONS_DIR, { recursive: true });
  const p = pathFor(session.id);
  writeFileSync(p, JSON.stringify(session, null, 2) + "\n", "utf8");
  return p;
}

export function loadSession(id: string): RecordedSession {
  return JSON.parse(readFileSync(pathFor(id), "utf8")) as RecordedSession;
}

export interface SessionSummary {
  id: string;
  createdAt: string;
  provider: string;
  model: string;
  task: string;
  events: number;
}

/** Lista as sessões gravadas, mais recentes primeiro. */
export function listSessions(): SessionSummary[] {
  if (!existsSync(SESSIONS_DIR)) return [];
  const summaries: SessionSummary[] = [];
  for (const file of readdirSync(SESSIONS_DIR)) {
    if (!file.endsWith(".json")) continue;
    try {
      const s = JSON.parse(readFileSync(join(SESSIONS_DIR, file), "utf8")) as RecordedSession;
      summaries.push({
        id: s.id,
        createdAt: s.createdAt,
        provider: s.provider,
        model: s.model,
        task: s.task,
        events: s.events.length,
      });
    } catch {
      /* arquivo inválido — ignora */
    }
  }
  return summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** A sessão gravada mais recente, se houver. */
export function latestSession(): RecordedSession | undefined {
  const [first] = listSessions();
  return first ? loadSession(first.id) : undefined;
}

/** Salva um relatório em ~/.nyx/reports/<id>.md e devolve o caminho. */
export function saveReport(id: string, markdown: string): string {
  mkdirSync(REPORTS_DIR, { recursive: true });
  const p = join(REPORTS_DIR, `${id}.md`);
  writeFileSync(p, markdown, "utf8");
  return p;
}
