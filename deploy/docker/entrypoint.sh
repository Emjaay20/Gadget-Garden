#!/usr/bin/env bash
set -e

export PATH="/usr/lib/postgresql/16/bin:/usr/lib/postgresql/15/bin:$PATH"

echo "==> [Gadgets Garden] Booting container..."

# 1. Ensure storage and cache permissions
mkdir -p /app/backend/storage/app/public/products
mkdir -p /app/backend/storage/framework/{cache,sessions,views}
mkdir -p /app/backend/storage/logs
mkdir -p /app/backend/bootstrap/cache
chown -R www-data:www-data /app/backend/storage /app/backend/bootstrap/cache
chmod -R 775 /app/backend/storage /app/backend/bootstrap/cache

# 2. Database Initialization
export PGDATA="/var/lib/postgresql/data"
mkdir -p "$PGDATA"
chown -R postgres:postgres "$PGDATA" /var/run/postgresql
chmod 700 "$PGDATA"

PG_BIN="$(find /usr/lib/postgresql -name initdb | head -n 1 | xargs dirname)"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
    echo "==> [Gadgets Garden] Initializing new PostgreSQL cluster in $PGDATA using $PG_BIN..."
    su - postgres -c "$PG_BIN/initdb -D $PGDATA --auth-local=trust --auth-host=md5"
fi

echo "==> [Gadgets Garden] Starting PostgreSQL server..."
su - postgres -c "$PG_BIN/pg_ctl -D $PGDATA -l $PGDATA/postgresql.log start"

# Wait for PostgreSQL
until su - postgres -c "$PG_BIN/pg_isready -q"; do
    echo "    Waiting for PostgreSQL to be ready..."
    sleep 1
done
echo "==> [Gadgets Garden] PostgreSQL is ready."

# Provision database and user
DB_NAME="${DB_DATABASE:-gadgetsgarden}"
DB_USER="${DB_USERNAME:-gadget_user}"
DB_PASS="${DB_PASSWORD:-gadget_secure_password_2026}"

su - postgres -c "$PG_BIN/psql -tc \"SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'\" | grep -q 1 || $PG_BIN/psql -c \"CREATE DATABASE $DB_NAME;\""
su - postgres -c "$PG_BIN/psql -tc \"SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'\" | grep -q 1 || $PG_BIN/psql -c \"CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASS';\""
su - postgres -c "$PG_BIN/psql -c \"GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;\""
su - postgres -c "$PG_BIN/psql -d $DB_NAME -c \"GRANT ALL ON SCHEMA public TO $DB_USER;\""
su - postgres -c "$PG_BIN/psql -d $DB_NAME -c \"ALTER DATABASE $DB_NAME OWNER TO $DB_USER;\""

# 3. Laravel Environment Setup
cd /app/backend

EXISTING_KEY=""
if [ -f .env ] && grep -q "^APP_KEY=base64:" .env; then
    EXISTING_KEY="$(grep "^APP_KEY=" .env | cut -d= -f2-)"
fi

if [ -n "$APP_KEY" ]; then
    ACTIVE_KEY="$APP_KEY"
elif [ -n "$EXISTING_KEY" ]; then
    ACTIVE_KEY="$EXISTING_KEY"
elif [ -f /var/lib/postgresql/data/.app_key ]; then
    ACTIVE_KEY="$(cat /var/lib/postgresql/data/.app_key)"
else
    ACTIVE_KEY="base64:$(openssl rand -base64 32 | tr -d '\n')"
fi

cat <<EOF > .env
APP_NAME="Gadgets Garden"
APP_ENV=production
APP_KEY=$ACTIVE_KEY
APP_DEBUG=false
APP_URL=${APP_URL:-http://localhost}

DB_CONNECTION=pgsql
DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-5432}
DB_DATABASE=$DB_NAME
DB_USERNAME=$DB_USER
DB_PASSWORD=$DB_PASS

BROADCAST_CONNECTION=log
CACHE_STORE=database
QUEUE_CONNECTION=database
SESSION_DRIVER=database

SHOP_PAYMENT_PROVIDER=${SHOP_PAYMENT_PROVIDER:-disabled}
SHOP_XENDIFY_BASE_URL=${SHOP_XENDIFY_BASE_URL:-https://api.xendify.com/api/v1}
SHOP_XENDIFY_SECRET_KEY=${SHOP_XENDIFY_SECRET_KEY:-}
SHOP_XENDIFY_WEBHOOK_KEY=${SHOP_XENDIFY_WEBHOOK_KEY:-}
SHOP_XENDIFY_PROVIDER=${SHOP_XENDIFY_PROVIDER:-safehaven}
SHOP_LAYAWAY_ENABLED=${SHOP_LAYAWAY_ENABLED:-true}
MAIL_MAILER=${MAIL_MAILER:-log}
MAIL_HOST=${MAIL_HOST:-}
MAIL_PORT=${MAIL_PORT:-587}
MAIL_USERNAME=${MAIL_USERNAME:-}
MAIL_PASSWORD=${MAIL_PASSWORD:-}
MAIL_FROM_ADDRESS=${MAIL_FROM_ADDRESS:-hello@gadgetsgarden.ng}
MAIL_FROM_NAME=${MAIL_FROM_NAME:-"Gadgets Garden"}
EOF
chown www-data:www-data .env

# Save active key for persistence across container restarts
echo "$ACTIVE_KEY" > /var/lib/postgresql/data/.app_key 2>/dev/null || true

echo "==> [Gadgets Garden] Running database migrations..."
php artisan migrate --force

echo "==> [Gadgets Garden] Seeding roles and permissions..."
php artisan db:seed --class=RolePermissionSeeder --force

echo "==> [Gadgets Garden] Ensuring owner account exists..."
OWNER_EMAIL="${OWNER_EMAIL:-}"
OWNER_PASS="${OWNER_PASSWORD:-}"
OWNER_NAME="${OWNER_NAME:-Store Owner}"

if [ -n "$OWNER_EMAIL" ] && [ -n "$OWNER_PASS" ]; then
php artisan tinker --execute="
\$email = '$OWNER_EMAIL';
\$pass = '$OWNER_PASS';
\$name = '$OWNER_NAME';
if (!\App\Models\User::where('email', \$email)->exists()) {
    \$u = new \App\Models\User();
    \$u->name = \$name;
    \$u->email = \$email;
    \$u->password = bcrypt(\$pass);
    \$u->is_active = true;
    \$u->save();
    \$u->assignRole(\App\Support\Permissions::OWNER);
    echo 'Created owner: ' . \$email . PHP_EOL;
} else {
    echo 'Owner already exists: ' . \$email . PHP_EOL;
}
"
else
    echo "==> No bootstrap owner configured; existing staff accounts are unchanged."
fi

echo "==> [Gadgets Garden] Ensuring default categories exist..."
php artisan tinker --execute="
\$rows = [
    ['laptops', 'Laptops', 'Premium new and foreign-used laptops for work, school and gaming.', 1],
    ['gaming', 'Gaming laptops', 'High-refresh machines with discrete graphics.', 2],
    ['accessories', 'Accessories', 'Chargers, bags, mice and everything in between.', 3],
    ['smartphones', 'Smartphones', 'Flagship and budget smartphones.', 4],
    ['tablets', 'Tablets', 'iPads and Android tablets.', 5],
];
foreach (\$rows as [\$slug, \$name, \$description, \$sort]) {
    \App\Models\Category::firstOrCreate(
        ['slug' => \$slug],
        ['name' => \$name, 'description' => \$description, 'sort_order' => \$sort]
    );
}
"

echo "==> [Gadgets Garden] Linking storage..."
php artisan storage:link 2>/dev/null || true

# Cache routes and config
php artisan config:cache
php artisan route:cache
php artisan event:cache

echo "==> [Gadgets Garden] Starting Supervisor (Nginx, PHP-FPM, Next.js Backoffice, Queue)..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
