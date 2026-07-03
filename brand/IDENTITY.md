# Nyx — Identidade Visual

> **Nyx** (Νύξ) é a deusa grega primordial da noite. Nome curto, fácil de digitar
> num terminal (`nyx run ...`), com estética *stealth* que combina com um agente
> autônomo que opera nas sombras — em qualquer provider, em qualquer canal.

## Conceito

Um agente que **enxerga no escuro**: multi-provider, autônomo, sem lock-in.
A marca gira em torno de **noite + lua crescente + brilho de terminal**.

## Paleta

| Papel            | Nome            | Hex        | Uso                                        |
| ---------------- | --------------- | ---------- | ------------------------------------------ |
| Fundo            | `void`          | `#0B0A12`  | Backgrounds, terminal, telas               |
| Superfície       | `midnight`      | `#141221`  | Cards, painéis                             |
| Primária         | `nyx-violet`    | `#8B5CF6`  | Marca, botões, destaques                   |
| Primária (forte) | `nyx-indigo`    | `#6D28D9`  | Hover, gradiente                           |
| Acento           | `moon-cyan`     | `#22D3EE`  | Links, foco, "brilho" de terminal          |
| Luar             | `moon-silver`   | `#C7C9E0`  | Texto secundário                           |
| Ouro lunar       | `crescent-gold` | `#E8C468`  | Detalhe raro / lua                         |
| Texto            | `starlight`     | `#EDEDF7`  | Texto principal                            |
| Perigo           | `signal-red`    | `#F43F5E`  | Erros, alertas                             |

Gradiente da marca: `#6D28D9 → #8B5CF6 → #22D3EE` (indigo → violeta → ciano).

## Tipografia

- **Marca / títulos:** Space Grotesk (geométrica, moderna).
- **Interface:** Inter.
- **Código / CLI:** JetBrains Mono (fallback: Fira Code, ui-monospace).

## Logo

`brand/logo.svg` — lua crescente com um brilho ciano, dentro de um círculo escuro.
Funciona em favicon (16px) e em hero. Versão monocromática: usar `nyx-violet`
sobre `void`, ou `starlight` sobre fundo escuro.

## Voz

Direta, técnica, sem enrolação. Terminal-first. "Menos ritual, mais controle."

## Banner do CLI (ASCII)

```
   ╭─╮ ╷ ╷ ╷ ╷
   │ │ │╲│  ╳
   ╰─╯ ╵ ╵ ╵ ╵   nyx · o agente que enxerga no escuro
```
