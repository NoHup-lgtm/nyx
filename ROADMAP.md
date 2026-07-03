# Roadmap do Nyx

Ordem sugerida. Cada fase entrega algo usável de ponta a ponta.

## Fase 0 — Fundação ✅ (atual)
- [x] Monorepo TypeScript (core + cli)
- [x] Camada multi-provider: OpenAI, OpenRouter, NVIDIA NIM, Anthropic, Ollama
- [x] Adapter OpenAI-compatible (baseUrl trocável) + adapter Anthropic
- [x] Streaming de resposta (SSE) sem dependências pesadas
- [x] CLI: `chat` (REPL + one-shot), `providers`, `config`
- [x] Config em `~/.nyx/config.json` + carregamento de `.env`
- [x] Identidade visual (logo, paleta, banner)

## Fase 1 — Agente de verdade
- [ ] Abstração de **tools / function-calling** unificada entre providers
- [ ] Loop autônomo (planejar → agir → observar → repetir) com limite de passos
- [ ] Tools base: shell, filesystem, HTTP fetch, busca web
- [ ] Sistema de permissões/allowlist por tool (importante para o público de segurança)
- [ ] Sessões e memória persistente

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
