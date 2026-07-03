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
  gold: (s: string) => `\x1b[38;5;179m${s}\x1b[0m`,
};

const ART = [
  "  ███╗   ██╗ ██╗   ██╗ ██╗  ██╗",
  "  ████╗  ██║ ╚██╗ ██╔╝ ╚██╗██╔╝",
  "  ██╔██╗ ██║  ╚████╔╝   ╚███╔╝ ",
  "  ██║╚██╗██║   ╚██╔╝    ██╔██╗ ",
  "  ██║ ╚████║    ██║    ██╔╝ ██╗",
  "  ╚═╝  ╚═══╝    ╚═╝    ╚═╝  ╚═╝",
];

/** Logo grande em ASCII com a tagline. */
export function banner(): string {
  const art = ART.map((line) => violet(line)).join("\n");
  return (
    "\n" +
    art +
    "\n" +
    dim("        o agente que enxerga no escuro") +
    "\n"
  );
}

/** Linha de status compacta (provider · modelo · cwd). */
export function statusLine(
  provider: string,
  model: string,
  extra?: string,
): string {
  const parts = [
    dim("provider ") + violet(provider),
    dim("modelo ") + cyan(model || "—"),
  ];
  if (extra) parts.push(dim(extra));
  return parts.join(dim("  ·  "));
}
