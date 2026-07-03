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

## Instalação

Requisito: **Node 20+**.

```bash
curl -fsSL https://raw.githubusercontent.com/NoHup-lgtm/nyx/main/install.sh | sh
```

O instalador clona, compila e coloca o comando `nyx` no seu PATH.

## Começando — só 2 comandos

```bash
nyx setup   # escolhe provider, cola a API key e o modelo (wizard interativo)
nyx         # abre a interface e começa a conversar
```

É isso. `nyx setup` guarda tudo em `~/.nyx/config.json` (arquivo com permissão
`600`). Rode de novo a qualquer momento pra adicionar outro provider, trocar a
chave ou mudar o modelo.

<details>
<summary>Comandos extras</summary>

```bash
nyx chat -p openai -m gpt-4o-mini "quem é você?"   # pergunta única
nyx providers                                       # status dos providers
nyx tools                                           # ferramentas e permissões
nyx config show                                     # ver a config
```
</details>

### Rodando do código (dev / contribuindo)

```bash
cd nyx
npm install
npm run dev -- setup     # equivale a `nyx setup` sem instalar
npm run dev -- run "cheque o git status e resuma"
```

### Modo autônomo (agente com ferramentas)

O Nyx pode executar tarefas sozinho usando ferramentas (`shell`, `read_file`,
`write_file`, `list_dir`, `http_fetch`) dentro de um loop — sempre respeitando um
**sistema de permissões por ferramenta**:

```bash
# lista as tools e a permissão atual de cada uma
npm run dev -- tools

# executa uma tarefa de forma autônoma (pede confirmação p/ shell e escrita)
npm run dev -- run "verifique o git status e resuma o que mudou"

# controle fino de permissões (ideal p/ pentest):
npm run dev -- run "faça um recon básico em example.com" --allow http_fetch --deny shell
npm run dev -- run "organize esta pasta" --yes        # aprova tudo em modo 'ask'
```

Permissões padrão (seguras): leitura e rede liberadas; `shell` e `write_file`
pedem confirmação. Ajuste em `~/.nyx/config.json` (campo `permissions`) ou por flag.

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

- [x] Core multi-provider + CLI (`nyx`, `setup`, `chat`, `run`, `tools`)
- [x] Tools / function-calling + loop autônomo com permissões
- [x] Instalação via `curl` + UX de 2 comandos
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
