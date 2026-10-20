#!/usr/bin/env bash
#
# Local dev launcher for the Gadgets Garden workspace.
#
#   ./dev.sh                    everything
#   ./dev.sh storefront         just the storefront
#   ./dev.sh backend storefront the API + the storefront
#   ./dev.sh api                backend + queue worker
#   ./dev.sh front              storefront + backoffice
#   ./dev.sh --list             show services and ports
#
# Ctrl-C stops everything. Postgres is expected to be running already
# (Homebrew: `brew services start postgresql@14`).
#
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
ROOT="$PWD"

# ------------------------------------------------------------------ services
# name | directory | port (- for none) | command
SERVICES='
backend    | backend    | 8000 | php artisan serve --port=8000
queue      | backend    | -    | php artisan queue:listen --tries=1 --timeout=0
storefront | storefront | 3000 | npm run dev
backoffice | backoffice | 3001 | npm run dev
ai-agent   | ai-service  | 4000 | npm run dev
logs       | backend    | -    | php artisan pail --timeout=0
'

# `logs` is opt-in — pail is chatty and duplicates what the backend pane shows.
GROUP_ALL="backend queue storefront backoffice ai-agent"
GROUP_API="backend queue"
GROUP_FRONT="storefront backoffice"

C_RESET=$'\033[0m'
color_for() {
  case $1 in
    backend)    printf '\033[35m' ;;  # magenta
    queue)      printf '\033[34m' ;;  # blue
    storefront) printf '\033[32m' ;;  # green
    backoffice) printf '\033[33m' ;;  # yellow
    ai-agent)   printf '\033[36m' ;;  # cyan
    logs)       printf '\033[90m' ;;  # grey
    *)          printf '\033[37m' ;;
  esac
}

field() { # field <service> <1=dir|2=port|3=cmd>
  printf '%s\n' "$SERVICES" | awk -F'|' -v s="$1" -v n="$2" '
    { gsub(/^[ \t]+|[ \t]+$/, "", $1)
      if ($1 == s) { f=$(n+1); gsub(/^[ \t]+|[ \t]+$/, "", f); print f; exit } }'
}

known() { [[ -n "$(field "$1" 1)" ]]; }

die()  { printf '\033[31merror\033[0m %s\n' "$*" >&2; exit 1; }
note() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }

usage() {
  printf 'Services:\n'
  printf '%s\n' "$SERVICES" | awk -F'|' 'NF>1 {
    gsub(/^[ \t]+|[ \t]+$/,"",$1); gsub(/^[ \t]+|[ \t]+$/,"",$3); gsub(/^[ \t]+|[ \t]+$/,"",$4)
    printf "  %-11s %-6s %s\n", $1, ($3=="-" ? "" : ":" $3), $4 }'
  printf '\nGroups:\n'
  printf '  all         %s\n' "$GROUP_ALL"
  printf '  api         %s\n' "$GROUP_API"
  printf '  front       %s\n' "$GROUP_FRONT"
}

# ------------------------------------------------------------------ argument parsing
TARGETS=""
# Note: don't reach for "${@:-all}" — bash 3.2 (what macOS ships) collapses
# multiple arguments into one when the :- default is applied to $@.
[[ $# -eq 0 ]] && set -- all

case "$1" in
  --list|-l|--help|-h) usage; exit 0 ;;
esac

for arg in "$@"; do
  case "$arg" in
    all)   TARGETS="$TARGETS $GROUP_ALL" ;;
    api)   TARGETS="$TARGETS $GROUP_API" ;;
    front) TARGETS="$TARGETS $GROUP_FRONT" ;;
    *)     known "$arg" || die "unknown service [$arg] — try ./dev.sh --list"
           TARGETS="$TARGETS $arg" ;;
  esac
done

# de-duplicate while preserving order
SELECTED=""
for t in $TARGETS; do
  case " $SELECTED " in *" $t "*) continue ;; esac
  SELECTED="$SELECTED $t"
done

# ------------------------------------------------------------------ preflight
for t in $SELECTED; do
  dir="$(field "$t" 1)"
  [[ -d "$ROOT/$dir" ]] || die "$dir/ is missing — has it been scaffolded?"
  if [[ "$dir" != "backend" && ! -d "$ROOT/$dir/node_modules" ]]; then
    die "$dir/node_modules is missing — run: (cd $dir && npm install)"
  fi
done

# A dead Postgres surfaces as a wall of Laravel stack traces several seconds
# later; catching it here says the actual thing that is wrong.
case " $SELECTED " in
  *" backend "*|*" queue "*)
    if ! nc -z 127.0.0.1 5432 2>/dev/null; then
      die "Postgres is not listening on 5432 — try: brew services start postgresql@14"
    fi
    ;;
esac

# ------------------------------------------------------------------ run
PIDS=""

cleanup() {
  trap - INT TERM EXIT
  note "stopping…"
  # Kill whole process groups: `npm run dev` and `artisan serve` both spawn
  # children that outlive the parent otherwise, and the ports stay bound.
  for pid in $PIDS; do
    kill -TERM "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
  done
  wait 2>/dev/null
  exit 0
}
trap cleanup INT TERM EXIT

for t in $SELECTED; do
  dir="$(field "$t" 1)"
  port="$(field "$t" 2)"
  cmd="$(field "$t" 3)"
  color="$(color_for "$t")"

  note "$t${port:+ }${port/-/}${port:+ }→ $dir"

  # Each service runs in its own process group (set -m) so cleanup can take the
  # whole tree down, and every line is prefixed so one scrollback stays readable.
  (
    set -m
    cd "$ROOT/$dir" || exit 1
    # shellcheck disable=SC2086
    $cmd 2>&1 | while IFS= read -r line; do
      printf '%s%-11s%s %s\n' "$color" "$t" "$C_RESET" "$line"
    done
  ) &
  PIDS="$PIDS $!"
done

printf '\n'
note "running:$SELECTED"
for t in $SELECTED; do
  port="$(field "$t" 2)"
  [[ "$port" == "-" ]] && continue
  printf '    %-11s http://localhost:%s\n' "$t" "$port"
done
printf '\nCtrl-C to stop everything.\n\n'

wait
