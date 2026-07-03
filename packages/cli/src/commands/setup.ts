import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  CONFIG_PATH,
  PROVIDER_SPECS,
  loadConfig,
  resolveApiKey,
  saveConfig,
  type NyxConfig,
} from "@nyx/core";
import { banner, c } from "../banner.js";

function isReady(cfg: NyxConfig, id: string): boolean {
  const spec = PROVIDER_SPECS[id];
  if (!spec) return false;
  return Boolean(spec.keyless || cfg.keys?.[id] || resolveApiKey(spec, process.env));
}

/** Wizard interativo: escolhe provider, chave e modelo, e salva no config. */
export async function runSetup(): Promise<void> {
  process.stdout.write(banner());
  console.log(c.bold("  Configuração do Nyx") + c.dim("  (salvo em " + CONFIG_PATH + ")\n"));

  const cfg = loadConfig();
  cfg.keys ??= {};
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    let again = true;
    while (again) {
      const specs = Object.values(PROVIDER_SPECS);

      console.log(c.bold("Escolha um provider:\n"));
      specs.forEach((spec, i) => {
        const badge = isReady(cfg, spec.id) ? c.green("● configurado") : c.dim("○ pendente");
        console.log(
          `  ${c.cyan(String(i + 1).padStart(2))}. ${c.violet(spec.label.padEnd(20))} ${badge}`,
        );
      });

      const pick = (await rl.question(c.violet("\n  número › "))).trim();
      const idx = Number(pick) - 1;
      const spec = specs[idx];
      if (!spec) {
        console.log(c.red("  opção inválida.\n"));
        continue;
      }

      // Chave de API.
      if (!spec.keyless) {
        const existing = cfg.keys?.[spec.id] ?? resolveApiKey(spec, process.env);
        const hint = existing
          ? c.dim(` (enter mantém a atual: …${existing.slice(-4)})`)
          : c.dim(` (pegue em ${spec.docsUrl})`);
        const key = (await rl.question(c.violet(`  chave ${spec.label}`) + hint + c.violet(" › "))).trim();
        if (key) cfg.keys![spec.id] = key;
        else if (!existing) {
          console.log(c.red("  sem chave — provider não ficará pronto.\n"));
        }
      } else {
        console.log(c.dim(`  ${spec.label} é local, não precisa de chave.`));
      }

      // Modelo.
      const modelHint = c.dim(` (enter usa ${spec.defaultModel})`);
      const model = (await rl.question(c.violet("  modelo") + modelHint + c.violet(" › "))).trim();

      // Define como padrão.
      cfg.defaultProvider = spec.id;
      cfg.defaultModel = model || cfg.defaultModel || spec.defaultModel;
      saveConfig(cfg);

      console.log(
        c.green(`\n  ✓ ${spec.label} configurado como padrão`) +
          c.dim(` (modelo: ${cfg.defaultModel})`),
      );

      const more = (await rl.question(c.dim("\n  configurar outro provider? [y/N] "))).trim().toLowerCase();
      again = more === "y" || more === "yes" || more === "s" || more === "sim";
      console.log("");
    }

    console.log(c.bold(c.green("Tudo pronto.")) + c.dim(" Rode ") + c.cyan("nyx") + c.dim(" para começar.\n"));
  } finally {
    rl.close();
  }
}
