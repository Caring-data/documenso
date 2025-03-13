###########################
#         BASE            #
###########################
FROM node:18-alpine AS base

# Instalar herramientas esenciales
RUN apk add --no-cache libc6-compat jq make cmake g++ openssl

WORKDIR /app

###########################
#   BUILDER CONTAINER    #
###########################
FROM base AS builder

WORKDIR /app

# Copiar el resto del código fuente
COPY package.json package-lock.json ./
RUN npm ci

# Instalar Turbo Repo de forma global
RUN npm install -g turbo

# Copiar todo el código fuente
COPY . .

# Construir la aplicación con Turbo
RUN npm run build

###########################
#   RUNNER CONTAINER    #
###########################
FROM base AS runner

WORKDIR /app

# Definir usuario sin privilegios
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --gid 1001 nodejs

# Copiar archivos desde el builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules/ ./node_modules
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/lingui.config.ts ./lingui.config.ts

COPY --from=builder /app/node_modules/.prisma/ ./node_modules/.prisma/
COPY --from=builder /app/packages/prisma/schema.prisma ./packages/prisma/schema.prisma
COPY --from=builder /app/packages/prisma/migrations ./packages/prisma/migrations

# Establecer usuario no root
USER nextjs

# Configurar la variable de entorno para producción
ENV NODE_ENV=production

# Comando de inicio
CMD ["turbo", "run", "start", "--filter=@documenso/web"]
