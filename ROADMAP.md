# Roadmap do Nyx

Ordem sugerida. Cada fase entrega algo usável de ponta a ponta.

## Fase 0 — Fundação ✅ (atual)
- [x] Monorepo TypeScript (core + cli)
- [x] Camada multi-provider: OpenAI, OpenRouter, NVIDIA NIM, Anthropic, Ollama
- [x] Adapter OpenAI-compatible (baseUrl trocável) + adapter Anthropic
- [x] Streaming de resposta (SSE) sem dependências pesadas
- [x] CLI: `chat` (REPL + one-shot), `providers`, `config`
- [x] Config em `~/.nyx/config.json` + carregamento de `.env`
- [x] Identidade visual (logo, paleta, banner ASCII grande)
- [x] UX de 2 comandos: `nyx` (interface interativa) e `nyx setup` (wizard de chaves)
- [x] Instalador via `curl` (install.sh) com launcher no PATH

## Fase 1 — Agente de verdade 🚧 (em andamento)
- [x] Abstração de **tools / function-calling** unificada entre providers (OpenAI + Anthropic)
- [x] Loop autônomo (planejar → agir → observar → repetir) com limite de passos (`runTask`)
- [x] Tools base: shell, read_file, write_file, list_dir, http_fetch
- [x] Sistema de permissões/allowlist por tool (allow/ask/deny) — `nyx tools`, flags `--allow/--deny/--yes`
- [x] CLI: `nyx run <tarefa>` (autônomo) e `nyx tools`
- [x] **Flight recorder**: grava cada passo (comandos + saídas reais) por sessão
- [x] **Escopo (scope-aware)**: `--scope` bloqueia alvos fora do autorizado (http_fetch + shell)
- [x] **`nyx report`**: gera PoC/relatório de bug bounty com evidência real da sessão
- [x] `nyx sessions` + slash commands no REPL (/run /scope /report /sessions)
- [ ] Tool de busca web
- [ ] Streaming da resposta final durante o loop
- [ ] Assinatura criptográfica do flight recorder (cadeia de custódia)
- [ ] Templates de relatório por plataforma (HackerOne/Bugcrowd/Intigriti)

## Fase 2 — Multi-superfície
- [ ] Desktop com **Tauri** (reusa o `@nyx/core`)
- [ ] Mobile com **Expo / React Native**
- [ ] Servidor/daemon local (API HTTP) pra clientes conversarem com o mesmo agente

## Fase 3 — Bots e autonomia
- [ ] Adapter Discord (discord.js)
- [ ] Adapter Telegram (Telegraf)
- [ ] Adapter WhatsApp (Baileys)
- [ ] Agentes agendados / gatilhos (cron, webhooks)

## Fase 4 — Ecossistema
- [ ] Sistema de plugins/extensões de terceiros
- [ ] Suporte a MCP (Model Context Protocol) como cliente e servidor
- [ ] Perfis de agente (personas + toolsets salvos)

## Fase 5 — Modelo próprio (futuro distante)
- [ ] Pacote `training/` em Python (PyTorch)
- [ ] Fine-tuning / LoRA sobre modelos abertos
- [ ] Servir o modelo próprio como mais um provider do Nyx (fecha o ciclo)

---

## Decisões de arquitetura já tomadas
- **CLI é o centro** do monorepo; todas as superfícies reusam `@nyx/core`.
- Providers OpenAI-compatible compartilham **um** adapter; só Anthropic tem o dele.
- Sem lock-in: qualquer endpoint compatível funciona via `--base-url`.
- Treino de modelo é fase final, isolado num pacote Python — não bloqueia nada.
