###########################
#         BASE            #
###########################
FROM node:18-alpine AS base
# Instalar herramientas esenciales
RUN apk add --no-cache libc6-compat jq make cmake g++ openssl
# Instalar dotenv-cli globalmente para los scripts de migración
RUN npm install -g dotenv-cli
# Instalar Chromium en el contenedor final
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

RUN apk add --no-cache ghostscript

WORKDIR /app

###########################
#         BUILDER         #
###########################
FROM base AS builder
# Instalar Turbo Repo de forma global
RUN npm install -g "turbo@^1.9.3"
# Copiar package.json y package-lock.json primero para aprovechar la caché de Docker
COPY package.json package-lock.json ./
COPY turbo.json ./
COPY packages/*/package.json ./dummy-packages/
COPY apps/*/package.json ./dummy-apps/
# Copiar el resto del código fuente
COPY . .
# Ejecutar npm ci para instalar todas las dependencias
RUN npm ci --ignore-scripts || npm ci
# Ejecutar turbo prune para reducir el tamaño de la imagen
RUN turbo prune --scope=@documenso/web --docker

###########################
#   INSTALLER CONTAINER   #
###########################
FROM base AS installer
WORKDIR /app
# Encryption keys
ARG NEXT_PRIVATE_ENCRYPTION_KEY="CAFEBABE"
ENV NEXT_PRIVATE_ENCRYPTION_KEY="$NEXT_PRIVATE_ENCRYPTION_KEY"
ARG NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY="DEADBEEF"
ENV NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY="$NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY"

# NUEVO: Skip ngrok download durante instalación
ENV NGROK_SKIP_DOWNLOAD=true

# Copiar los archivos generados por turbo prune
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
COPY --from=builder /app/lingui.config.ts ./lingui.config.ts

COPY --from=builder /app/assets ./assets

# Instalar dependencias con --legacy-peer-deps para evitar problemas de compatibilidad
RUN npm ci --legacy-peer-deps --ignore-scripts || npm ci --legacy-peer-deps
# Copiar el resto del código fuente
COPY --from=builder /app/out/full/ .
# Copiar el archivo turbo.json
COPY turbo.json turbo.json
# Verificar la estructura del proyecto
RUN ls -la apps/web/
# Construir la aplicación
RUN npx turbo run build --filter=@documenso/web...
# Verificar que se ha creado el directorio .next
RUN ls -la apps/web/.next || echo "Build directory not found!"

###########################
#     RUNNER CONTAINER    #
###########################
FROM base AS runner
WORKDIR /app
# Definir usuario sin privilegios
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
# Copiar node_modules y package.json desde la etapa installer
COPY --from=installer --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=installer --chown=nextjs:nodejs /app/package.json ./package.json
# Copiar todo el directorio apps/web (que incluye .next, public, etc.)
COPY --from=installer --chown=nextjs:nodejs /app/apps/web ./apps/web
# Copiar packages necesarios para la ejecución
COPY --from=installer --chown=nextjs:nodejs /app/packages ./packages
# Copiar turbo.json
COPY --from=installer --chown=nextjs:nodejs /app/turbo.json ./turbo.json
# Asegurar que se copien los archivos .env si existen
COPY --from=installer --chown=nextjs:nodejs /app/.env* ./

COPY --from=installer --chown=nextjs:nodejs /app/assets ./assets

# Cambiar permisos de los directorios necesarios
RUN chown -R nextjs:nodejs /app
USER nextjs
# Configurar la variable de entorno para producción
ENV NODE_ENV=production
# Exponer el puerto en el que se ejecutará Next.js
EXPOSE 3002
# Comando para ejecutar la aplicación - modificado para evitar el uso de dotenv directamente
CMD ["sh", "-c", "cd packages/prisma && npx prisma migrate deploy && cd ../../apps/web && npm run start"]
# npx prisma db seed
