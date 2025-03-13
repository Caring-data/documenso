###########################
#         BASE            #
###########################
FROM node:18-alpine AS base

# Instalar herramientas esenciales
RUN apk add --no-cache libc6-compat jq make cmake g++ openssl

WORKDIR /app

###########################
#         BUILDER         #
###########################
FROM base AS builder

# Instalar Turbo Repo de forma global
RUN npm install -g "turbo@^1.9.3"

# Copiar el resto del código fuente
COPY . .

# Instalar dependencias antes del build
RUN npm ci

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

# Copiar los archivos generados por turbo prune
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json

COPY --from=builder /app/lingui.config.ts ./lingui.config.ts

# Instalar dependencias
RUN npm ci

# Copiar el resto del código fuente
COPY --from=builder /app/out/full/ .

# Copiar el archivo turbo.json
COPY turbo.json turbo.json

# Instalar Turbo de forma global
RUN npm install -g "turbo@^1.
