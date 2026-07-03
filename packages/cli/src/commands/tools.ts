import { BUILTIN_TOOLS, loadConfig, resolvePolicy, PermissionManager } from "@nyx/core";
import { c } from "../banner.js";

const riskLabel: Record<string, string> = {
  read: "leitura",
  write: "escrita",
  exec: "execução",
  network: "rede",
};

const decisionColor: Record<string, (s: string) => string> = {
  allow: c.green,
  ask: c.cyan,
  deny: c.red,
};

export function toolsCommand(): void {
  const policy = resolvePolicy(loadConfig().permissions);
  const pm = new PermissionManager(policy);

  console.log(c.bold("Ferramentas disponíveis:\n"));
  for (const tool of BUILTIN_TOOLS) {
    const decision = pm.decisionFor(tool.name);
    const badge = (decisionColor[decision] ?? c.dim)(decision.padEnd(5));
    console.log(
      `  ${badge} ${c.violet(tool.name.padEnd(12))} ${c.dim(`[${riskLabel[tool.risk]}]`)}`,
    );
    console.log(`         ${c.dim(tool.description.split(".")[0] + ".")}`);
  }
  console.log(
    "\n" +
      c.dim("Legenda: ") +
      c.green("allow") +
      c.dim(" roda direto · ") +
      c.cyan("ask") +
      c.dim(" pede confirmação · ") +
      c.red("deny") +
      c.dim(" bloqueado"),
  );
  console.log(
    c.dim("Ajuste em ~/.nyx/config.json (campo \"permissions\") ou com flags do ") +
      c.cyan("nyx run") +
      c.dim("."),
  );
}
