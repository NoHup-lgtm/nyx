/* Cores ANSI mínimas, sem dependência externa. */
const violet = (s: string) => `\x1b[38;5;99m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[38;5;51m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

export const c = {
  violet,
  cyan,
  dim,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  red: (s: string) => `\x1b[38;5;203m${s}\x1b[0m`,
  green: (s: string) => `\x1b[38;5;114m${s}\x1b[0m`,
};

export function banner(): string {
  return [
    violet("   ╭─╮ ╷ ╷ ╷ ╷"),
    violet("   │ │ │╲│  ╳ "),
    violet("   ╰─╯ ╵ ╵ ╵ ╵ ") + dim("· o agente que enxerga no escuro"),
    "",
  ].join("\n");
}
