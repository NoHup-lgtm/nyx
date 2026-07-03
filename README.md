<div align="center">

<img src="brand/logo.svg" width="120" alt="Nyx" />

# Nyx

**O agente de IA que enxerga no escuro.**
Autônomo · open-source · provider-agnostic — use *qualquer* API key.

`OpenAI` · `OpenRouter` · `NVIDIA NIM` · `Anthropic` · `Ollama (local)` · e o que você plugar.

</div>

---

## Por que Nyx

A maioria das ferramentas de agente te prende a um provider. O Nyx faz o contrário:
uma camada única de providers onde **trocar de modelo é trocar uma flag**. Levou uma
chave? Já roda.

```bash
nyx chat -p openrouter -m "anthropic/claude-3.5-sonnet" "resuma este log"
nyx chat -p nvidia     -m "meta/llama-3.1-70b-instruct" "explique este payload"
nyx chat -p ollama     -m "llama3.1"                     "roda 100% local, sem nuvem"
```

## Instalação (dev)

Requisitos: **Node 20+**. pnpm ou npm (funciona com os dois).

```bash
cd nyx
npm install          # ou: pnpm install
cp .env.example .env # preencha só a(s) chave(s) que você tem
npm run dev -- providers
```

## Uso rápido

```bash
# lista providers e mostra quais já têm chave no ambiente
npm run dev -- providers

# conversa interativa (REPL) com o provider padrão
npm run dev -- chat

# pergunta única
npm run dev -- chat -p openai -m gpt-4o-mini "quem é você?"

# define padrões pra não repetir flags
npm run dev -- config set defaultProvider openrouter
npm run dev -- config set defaultModel "openai/gpt-4o-mini"
```

Depois de `npm run build`, o binário `nyx` fica disponível (`npm link` ou instalação global).

## Chaves de API

O Nyx procura a chave no ambiente automaticamente (ou num `.env` no diretório atual):

| Provider    | Variável            | Onde pegar                         |
| ----------- | ------------------- | ---------------------------------- |
| OpenAI      | `OPENAI_API_KEY`    | platform.openai.com                |
| OpenRouter  | `OPENROUTER_API_KEY`| openrouter.ai/keys                 |
| NVIDIA NIM  | `NVIDIA_API_KEY`    | build.nvidia.com                   |
| Anthropic   | `ANTHROPIC_API_KEY` | console.anthropic.com              |
| Ollama      | — (local)           | ollama.com                         |

Também dá pra passar a chave direto: `--api-key`, e um endpoint custom: `--base-url`
(gateway próprio, self-hosted, LM Studio, etc.).

## Arquitetura

Monorepo com o CLI no centro. Tudo compartilha o mesmo `@nyx/core`.

```
nyx/
├── packages/
│   ├── core/          @nyx/core — motor do agente + camada de providers
│   │   └── src/
│   │       ├── providers/   contrato Provider + adapters (OpenAI-compat, Anthropic)
│   │       ├── agent/       Agent: histórico + loop de conversa
│   │       └── config/      config em ~/.nyx/config.json + env
│   └── cli/           @nyx/cli — o comando `nyx`
├── brand/             identidade visual (logo, paleta, guia)
└── (futuro) desktop/ · mobile/ · bots/
```

**Como um provider funciona:** OpenAI, OpenRouter e NVIDIA falam o formato
*Chat Completions* da OpenAI — um só adapter (`OpenAICompatibleProvider`) cobre os três,
mudando só a `baseUrl`. Anthropic tem API própria (`AnthropicProvider`). Adicionar um
novo provider OpenAI-compatible é uma entrada em `providers/registry.ts`.

## Roadmap

Veja [ROADMAP.md](ROADMAP.md). Resumo:

- [x] Core multi-provider + CLI (`chat`, `providers`, `config`)
- [ ] Tools / function-calling + loop autônomo
- [ ] Memória persistente e sessões
- [ ] Desktop (Tauri) e mobile (Expo)
- [ ] Bots: Discord, Telegram, WhatsApp
- [ ] Treino de modelo próprio (bem no futuro)

## Uso responsável

O Nyx é uma ferramenta *dual-use*, pensada também para times de segurança
(red team / blue team, pentest, pesquisa e CTF). Como toda ferramenta desse tipo:

- Use **apenas** em sistemas que você possui ou tem **autorização explícita** para testar.
- Você é responsável por cumprir as leis aplicáveis e os termos de uso de cada provider de IA.
- O software é fornecido "como está", sem garantias (veja a [LICENSE](LICENSE)).

## Licença

MIT — veja [LICENSE](LICENSE).
