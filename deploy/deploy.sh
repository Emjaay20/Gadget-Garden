#!/usr/bin/env bash
#
# Deploy Gadgets Garden. Run ON THE SERVER, as the `deploy` user.
#
#   ./deploy.sh            everything
#   ./deploy.sh backend    just the API
#   ./deploy.sh front      both Next apps
#
# Assumes deploy/setup.sh has already run once on this box.
#
set -euo pipefail

ROOT=/srv/gadgetsgarden
TARGETS="${*:-all}"

note() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
die()  { printf '\033[31merror\033[0m %s\n' "$*" >&2; exit 1; }

[[ -d "$ROOT" ]] || die "$ROOT does not exist — run setup.sh first."

wants() {
  case "$TARGETS" in
    *all*) return 0 ;;
    *"$1"*) return 0 ;;
    *) return 1 ;;
  esac
}

cd "$ROOT"

note "fetching"
git fetch --quiet origin
git reset --hard --quiet origin/main

# ---------------------------------------------------------------- backend
if wants backend || wants all; then
  note "backend: dependencies"
  cd "$ROOT/backend"
  composer install --no-dev --optimize-autoloader --no-interaction --quiet

  # Migrations run BEFORE the apps restart, so the new code never meets the old
  # schema. `--force` because there is no TTY here.
  note "backend: migrations"
  php artisan migrate --force

  note "backend: caches"
  php artisan config:cache
  php artisan route:cache
  php artisan event:cache
  # Deliberately NOT `view:cache` — there are no Blade views beyond the mail
  # templates, and caching them has bitten deploys before with stale markup.

  note "backend: restarting workers"
  # Workers hold framework state between jobs, so they must be recycled or they
  # keep running the previous release's code.
  sudo systemctl restart gg-queue.service
fi

# ------------------------------------------------------------------ front
for app in storefront backoffice; do
  if wants front || wants all || wants "$app"; then
    note "$app: dependencies"
    cd "$ROOT/$app"
    npm ci --omit=dev --silent

    note "$app: build"
    # A failed build must not take the running site down, so the restart below
    # only happens if this succeeds — `set -e` handles that.
    npm run build

    note "$app: restarting"
    sudo systemctl restart "gg-next@$app.service"
  fi
done

# ----------------------------------------------------------------- verify
note "verifying"
sleep 4

for probe in \
  "https://api.gadgetsgarden.ng/up|API" \
  "https://gadgetsgarden.ng|storefront" \
  "https://admin.gadgetsgarden.ng/login|backoffice"
do
  url="${probe%%|*}"
  name="${probe##*|}"
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$url" || echo 000)

  if [[ "$code" == "200" ]]; then
    printf '    %-12s %s\n' "$name" "ok"
  else
    die "$name returned $code — check: journalctl -u gg-next@$name -n 50"
  fi
done

note "done"
