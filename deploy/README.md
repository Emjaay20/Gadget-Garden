# Deploying Gadgets Garden

Three processes behind Caddy on one box:

| | Served by | Port |
|---|---|---|
| Storefront | `gg-next@storefront` | 3000 |
| Backoffice | `gg-next@backoffice` | 3001 |
| API | php-fpm, via Caddy's `php_fastcgi` | — |
| Queue worker | `gg-queue` | — |
| Scheduler | `gg-scheduler.timer` (every minute) | — |

## First time on a box

1. Install: Caddy, PHP 8.3 + fpm, Composer, Node 22, PostgreSQL 14+, git.
2. `sudo useradd -m -d /srv/gadgetsgarden deploy` and clone the repo into it.
3. `createdb gadgetsgarden` and create the role the app connects as.
4. Copy `deploy/env/*.example` into place and fill them in (below).
5. Install the units:
   ```
   sudo cp deploy/systemd/* /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now gg-next@storefront gg-next@backoffice
   sudo systemctl enable --now gg-queue.service gg-scheduler.timer
   ```
6. `sudo cp deploy/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy`
7. `cd backend && php artisan migrate --force && php artisan db:seed --class=RolePermissionSeeder`
8. Create the first owner account by hand — `DatabaseSeeder` seeds **development**
   logins with the password `password` and must never be run here.

## Every deploy after that

```
ssh deploy@…
cd /srv/gadgetsgarden && ./deploy/deploy.sh
```

Migrations run before the apps restart, so new code never meets the old schema.
The script probes all three hosts afterwards and fails loudly if any is not 200.

## Going live with Xendify

The payment layer ships bound to `mock`, which settles orders on request and
authenticates nothing. **Switching it on is four steps, in this order:**

1. Set the merchant credentials in `backend/.env`:
   ```
   SHOP_PAYMENT_PROVIDER=xendify
   SHOP_XENDIFY_SECRET_KEY=sk_live_…
   SHOP_XENDIFY_WEBHOOK_KEY=…
   SHOP_XENDIFY_PROVIDER=safehaven
   ```
2. Register the webhook with Xendify, pointing at:
   ```
   https://api.gadgetsgarden.ng/api/shop/payments/webhook/xendify
   ```
   The last path segment must match the gateway's `name()`, which is `xendify` —
   not the bank partner.
3. `php artisan config:cache` and restart the queue worker, or the old
   configuration stays resident.
4. Place a real ₦100 test order end to end and confirm the webhook arrives.

### Two things about that webhook

**The webhook key is the only lock on settlement.** Xendify authenticates with a
static bearer token, not a per-request signature, and a body that clears it is
believed without any outbound confirmation call. Treat it exactly like the secret
key: never log it, rotate it if it is ever exposed.

**It fails closed.** With `SHOP_XENDIFY_WEBHOOK_KEY` unset, every webhook is
rejected with a 401 and nothing settles. That is deliberate — a misconfigured
deploy should stop taking orders, not start accepting anonymous ones.

Once a real provider is bound, `POST /api/shop/payments/mock-settle` returns 404,
and the storefront's "simulate payment" controls disappear on their own because
they hide off that 404. There is no environment flag to remember.

## Where things live

```
/srv/gadgetsgarden/
  backend/          Laravel — Caddy serves backend/public
  storefront/       Next, port 3000
  backoffice/       Next, port 3001
  deploy/           this directory
```

## When something is wrong

```
journalctl -u gg-next@storefront -n 100 -f
journalctl -u gg-queue -n 100 -f
systemctl list-timers gg-scheduler.timer
tail -f /srv/gadgetsgarden/backend/storage/logs/laravel.log
```

**If orders stop settling**, check the queue worker first — receipts are queued,
so a dead worker looks like "payments not working" to staff even though the money
has arrived and the order is correctly marked paid.

**If stock seems to be disappearing**, check the scheduler:
`orders:expire-unpaid` is what puts abandoned reservations back on the shelf, and
if the timer is not running every unfinished checkout silently removes a
one-of-a-kind machine from the catalogue.
