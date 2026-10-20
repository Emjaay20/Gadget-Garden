# =========================================================================
# Stage 1: Build Next.js Customer Storefront
# =========================================================================
FROM node:22-bookworm-slim AS storefront-builder
WORKDIR /build

COPY storefront/package*.json ./
RUN npm ci

COPY storefront/ ./
ENV NODE_ENV=production
ENV API_URL=http://127.0.0.1:8000/api
RUN npm run build

# =========================================================================
# Stage 2: Build Next.js Backoffice Admin Dashboard
# =========================================================================
FROM node:22-bookworm-slim AS backoffice-builder
WORKDIR /build

COPY backoffice/package*.json ./
RUN npm ci

COPY backoffice/ ./
ENV NODE_ENV=production
ENV API_URL=http://127.0.0.1:8000/api
RUN npm run build

# =========================================================================
# Stage 3: Install Composer Dependencies for Laravel Backend
# =========================================================================
FROM composer:2 AS backend-builder
WORKDIR /build

COPY backend/composer*.json ./
RUN composer install --no-dev --no-scripts --optimize-autoloader --no-interaction --ignore-platform-reqs

# =========================================================================
# Stage 4: Unified Production Runtime (PHP 8.4 FPM + Nginx + PostgreSQL + Storefront + Backoffice)
# =========================================================================
FROM php:8.4-fpm-bookworm

LABEL maintainer="Gadgets Garden Team"
LABEL description="Gadgets Garden unified production deployment for AetherHost"

ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies & PostgreSQL
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    postgresql \
    postgresql-contrib \
    curl \
    git \
    unzip \
    libpq-dev \
    libzip-dev \
    libicu-dev \
    ca-certificates \
    gnupg \
    && docker-php-ext-install \
        pdo \
        pdo_pgsql \
        pgsql \
        bcmath \
        zip \
        intl \
        pcntl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 22 LTS for Next.js standalone servers
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Nginx, Supervisor, and Entrypoint configurations
COPY deploy/docker/nginx.conf /etc/nginx/sites-available/default
COPY deploy/docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY deploy/docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# 1. Setup Backend
COPY backend/ /app/backend/
COPY --from=backend-builder /build/vendor/ /app/backend/vendor/
RUN rm -f /app/backend/bootstrap/cache/*.php && cd /app/backend && php artisan package:discover --ansi

# 2. Setup Storefront Standalone
WORKDIR /app/storefront
COPY --from=storefront-builder /build/.next/standalone/ ./
COPY --from=storefront-builder /build/.next/static/ ./.next/static/
COPY --from=storefront-builder /build/public/ ./public/

# 3. Setup Backoffice Standalone
WORKDIR /app/backoffice
COPY --from=backoffice-builder /build/.next/standalone/ ./
COPY --from=backoffice-builder /build/.next/static/ ./.next/static/
COPY --from=backoffice-builder /build/public/ ./public/

# Permissions
RUN chown -R www-data:www-data /app/backend/storage /app/backend/bootstrap/cache \
    && chmod -R 775 /app/backend/storage /app/backend/bootstrap/cache

WORKDIR /app

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://127.0.0.1/up || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
