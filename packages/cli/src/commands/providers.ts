import { providerStatus } from "@nyx/core";
import { c } from "../banner.js";

export function providersCommand(): void {
  console.log(c.bold("Providers suportados:\n"));
  for (const { spec, ready } of providerStatus()) {
    const badge = ready ? c.green("● pronto") : c.dim("○ sem chave");
    const key = spec.envKeys[0] ? c.dim(`env: ${spec.envKeys[0]}`) : c.dim("sem chave (local)");
    console.log(
      `  ${badge}  ${c.violet(spec.id.padEnd(11))} ${spec.label.padEnd(20)} ${key}`,
    );
    console.log(`             ${c.dim(`modelo padrão: ${spec.defaultModel}`)}`);
  }
  console.log(
    "\n" + c.dim("Defina a chave no ambiente (ou num .env) e rode: ") +
      c.cyan("nyx chat --provider <id>"),
  );
}
