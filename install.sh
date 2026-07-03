#!/bin/sh
# ─── Instalador do Nyx ───────────────────────────────────────────────────────
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/SEU-USUARIO/nyx/main/install.sh | sh
#
# Variáveis opcionais:
#   NYX_REPO   URL do repositório git (padrão: o oficial)
#   NYX_HOME   onde instalar (padrão: ~/.nyx/app)
#   BIN_DIR    onde colocar o launcher `nyx` (padrão: ~/.local/bin)
set -e

REPO="${NYX_REPO:-https://github.com/SEU-USUARIO/nyx.git}"
NYX_HOME="${NYX_HOME:-$HOME/.nyx/app}"
BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"

say()  { printf '\033[38;5;99m»\033[0m %s\n' "$1"; }
ok()   { printf '\033[38;5;114m✓\033[0m %s\n' "$1"; }
die()  { printf '\033[38;5;203m✗ %s\033[0m\n' "$1" >&2; exit 1; }

printf '\n\033[38;5;99m  ███╗   ██╗ ██╗   ██╗ ██╗  ██╗\n'
printf '  ████╗  ██║ ╚██╗ ██╔╝ ╚██╗██╔╝\n'
printf '  ██╔██╗ ██║  ╚████╔╝   ╚███╔╝\n'
printf '  ██║╚██╗██║   ╚██╔╝    ██╔██╗\n'
printf '  ██║ ╚████║    ██║    ██╔╝ ██╗\033[0m\n'
printf '\033[2m        o agente que enxerga no escuro\033[0m\n\n'

# ── Dependências ──
command -v git  >/dev/null 2>&1 || die "git não encontrado. Instale git e tente de novo."
command -v node >/dev/null 2>&1 || die "Node.js não encontrado. Instale Node 20+ (https://nodejs.org)."

NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 20 ] || die "Node 20+ é necessário (você tem $(node -v))."

# npm ou pnpm
if command -v pnpm >/dev/null 2>&1; then PKG="pnpm"; else PKG="npm"; fi

# ── Clonar / atualizar ──
if [ -d "$NYX_HOME/.git" ]; then
  say "Atualizando instalação em $NYX_HOME"
  git -C "$NYX_HOME" pull --ff-only
else
  say "Clonando $REPO"
  mkdir -p "$(dirname "$NYX_HOME")"
  git clone --depth 1 "$REPO" "$NYX_HOME"
fi

# ── Build ──
say "Instalando dependências ($PKG)"
( cd "$NYX_HOME" && $PKG install --silent )
say "Compilando"
( cd "$NYX_HOME" && $PKG run build >/dev/null )

# ── Launcher ──
mkdir -p "$BIN_DIR"
cat > "$BIN_DIR/nyx" <<EOF
#!/bin/sh
exec node "$NYX_HOME/packages/cli/dist/index.js" "\$@"
EOF
chmod +x "$BIN_DIR/nyx"
ok "Launcher instalado em $BIN_DIR/nyx"

# ── PATH ──
case ":$PATH:" in
  *":$BIN_DIR:"*) : ;;
  *)
    printf '\n\033[38;5;179m⚠ %s não está no seu PATH.\033[0m\n' "$BIN_DIR"
    printf '  Adicione ao seu shell:  \033[38;5;51mexport PATH="%s:$PATH"\033[0m\n' "$BIN_DIR"
    ;;
esac

printf '\n'
ok "Nyx instalado!"
printf '  Configure com:  \033[38;5;51mnyx setup\033[0m\n'
printf '  Depois rode:    \033[38;5;51mnyx\033[0m\n\n'
