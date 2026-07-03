import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { PROVIDER_SPECS, loadConfig, resolveApiKey } from "@nyx/core";
import { c } from "../banner.js";
import { runSetup } from "./setup.js";
import { chatCommand } from "./chat.js";

/** Comando padrão: `nyx` sem argumentos. Garante configuração e abre a interface. */
export async function homeCommand(): Promise<void> {
  const cfg = loadConfig();
  const id = cfg.defaultProvider;
  const spec = PROVIDER_SPECS[id];
  const configured = Boolean(
    spec && (spec.keyless || cfg.keys?.[id] || resolveApiKey(spec, process.env)),
  );

  if (!configured) {
    console.log(c.dim("\n  Nenhum provider configurado ainda.\n"));
    const rl = createInterface({ input: stdin, output: stdout });
    const ans = (await rl.question(c.violet("  rodar o ") + c.bold("nyx setup") + c.violet(" agora? [Y/n] ")))
      .trim()
      .toLowerCase();
    rl.close();

    const yes = ans === "" || ans === "y" || ans === "yes" || ans === "s" || ans === "sim";
    if (!yes) {
      console.log(c.dim("  ok — quando quiser, rode: ") + c.cyan("nyx setup") + "\n");
      return;
    }
    await runSetup();
  }

  // Abre a interface interativa (REPL) com o provider/modelo configurados.
  await chatCommand(undefined, {});
}
