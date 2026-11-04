FROM dunglas/frankenphp:1-php8.4-alpine

ENV APP_ENV=prod
ENV APP_DEBUG=0
ENV SERVER_NAME=:80

# Install required PHP extensions
RUN install-php-extensions \
    ctype \
    iconv \
    intl \
    opcache \
    pdo_sqlite \
    pdo_pgsql

WORKDIR /app

# Copy application files
COPY . .

# Install production dependencies
RUN composer install --no-dev --optimize-autoloader --no-scripts

# Warm up cache and publish assets
RUN php bin/console cache:clear --env=prod \
    && php bin/console assets:install public --env=prod

# Set correct permissions for cache and logs
RUN chown -R unit:unit /app/var

USER root

CMD ["frankenphp", "run", "--config", "/etc/caddy/Caddyfile"]

